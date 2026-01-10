import { adminAuth, adminDb } from "@/lib/firebase/admin"
import {
  getHistory,
  getRatings,
  getWatchlist,
  refreshAccessToken,
} from "@/lib/trakt"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

// Get TMDB metadata for a movie or show
async function getTmdbMetadata(
  tmdbId: number,
  type: "movie" | "tv",
): Promise<{
  title: string
  posterPath: string | null
  releaseDate: string | null
} | null> {
  try {
    const response = await fetch(
      `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${process.env.TMDB_API_KEY}`,
    )
    if (!response.ok) return null

    const data = await response.json()
    return {
      title: data.title || data.name,
      posterPath: data.poster_path,
      releaseDate: data.release_date || data.first_air_date || null,
    }
  } catch {
    return null
  }
}

export async function POST() {
  try {
    // Get session cookie
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get("session")?.value

    if (!sessionCookie || !adminAuth || !adminDb) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify the session and get user ID
    const decodedToken = await adminAuth.verifySessionCookie(
      sessionCookie,
      true,
    )
    const userId = decodedToken.uid

    // Get user document with Trakt tokens
    const userDoc = await adminDb.doc(`users/${userId}`).get()

    if (!userDoc.exists || !userDoc.data()?.traktConnected) {
      return NextResponse.json(
        { error: "Not connected to Trakt" },
        { status: 400 },
      )
    }

    const userData = userDoc.data()!
    let accessToken = userData.traktAccessToken as string
    let refreshToken = userData.traktRefreshToken as string
    const expiresAt =
      userData.traktTokenExpiresAt?.toMillis?.() || userData.traktTokenExpiresAt

    // Refresh token if expired
    if (Date.now() > expiresAt - 60000) {
      // Refresh 1 minute before expiry
      try {
        const newTokens = await refreshAccessToken(refreshToken)
        accessToken = newTokens.access_token
        refreshToken = newTokens.refresh_token

        // Update stored tokens on user document
        await adminDb.doc(`users/${userId}`).update({
          traktAccessToken: accessToken,
          traktRefreshToken: refreshToken,
          traktTokenExpiresAt: new Date(
            (newTokens.created_at + newTokens.expires_in) * 1000,
          ),
        })
      } catch (error) {
        console.error("Failed to refresh token:", error)
        return NextResponse.json(
          { error: "Token refresh failed" },
          { status: 401 },
        )
      }
    }

    // Fetch data from Trakt
    const [
      movieRatings,
      showRatings,
      episodeRatings,
      movieWatchlist,
      showWatchlist,
      movieHistory,
    ] = await Promise.all([
      getRatings(accessToken, "movies"),
      getRatings(accessToken, "shows"),
      getRatings(accessToken, "episodes"),
      getWatchlist(accessToken, "movies"),
      getWatchlist(accessToken, "shows"),
      getHistory(accessToken, "movies", 500),
    ])

    let totalItems = 0
    const batch = adminDb.batch()

    // Sync movie ratings
    for (const item of movieRatings) {
      if (!item.movie?.ids.tmdb) continue

      const tmdbId = item.movie.ids.tmdb
      const metadata = await getTmdbMetadata(tmdbId, "movie")
      const docId = `movie-${tmdbId}`

      batch.set(
        adminDb.doc(`users/${userId}/ratings/${docId}`),
        {
          id: tmdbId,
          mediaType: "movie",
          rating: item.rating,
          title: metadata?.title || item.movie.title,
          posterPath: metadata?.posterPath || null,
          releaseDate: metadata?.releaseDate || null,
          ratedAt: new Date(item.rated_at).getTime(),
        },
        { merge: true },
      )

      totalItems++
    }

    // Sync show ratings
    for (const item of showRatings) {
      if (!item.show?.ids.tmdb) continue

      const tmdbId = item.show.ids.tmdb
      const metadata = await getTmdbMetadata(tmdbId, "tv")
      const docId = `tv-${tmdbId}`

      batch.set(
        adminDb.doc(`users/${userId}/ratings/${docId}`),
        {
          id: tmdbId,
          mediaType: "tv",
          rating: item.rating,
          title: metadata?.title || item.show.title,
          posterPath: metadata?.posterPath || null,
          releaseDate: metadata?.releaseDate || null,
          ratedAt: new Date(item.rated_at).getTime(),
        },
        { merge: true },
      )

      totalItems++
    }

    // Sync episode ratings
    for (const item of episodeRatings) {
      if (!item.show?.ids.tmdb || !item.episode) continue

      const tvShowId = item.show.ids.tmdb
      const season = item.episode.season
      const episode = item.episode.number
      const docId = `episode-${tvShowId}-${season}-${episode}`

      batch.set(
        adminDb.doc(`users/${userId}/ratings/${docId}`),
        {
          id: docId,
          mediaType: "episode",
          rating: item.rating,
          episodeName: item.episode.title,
          tvShowId,
          tvShowName: item.show.title,
          seasonNumber: season,
          episodeNumber: episode,
          posterPath: null,
          ratedAt: new Date(item.rated_at).getTime(),
        },
        { merge: true },
      )

      totalItems++
    }

    // Sync movie watchlist
    const watchlistItems: Record<string, unknown> = {}
    for (const item of movieWatchlist) {
      if (!item.movie?.ids.tmdb) continue

      const tmdbId = item.movie.ids.tmdb
      const metadata = await getTmdbMetadata(tmdbId, "movie")

      watchlistItems[String(tmdbId)] = {
        id: tmdbId,
        media_type: "movie",
        title: metadata?.title || item.movie.title,
        poster_path: metadata?.posterPath || null,
        release_date: metadata?.releaseDate || null,
        addedAt: new Date(item.listed_at).getTime(),
      }
      totalItems++
    }

    // Sync show watchlist
    for (const item of showWatchlist) {
      if (!item.show?.ids.tmdb) continue

      const tmdbId = item.show.ids.tmdb
      const metadata = await getTmdbMetadata(tmdbId, "tv")

      watchlistItems[String(tmdbId)] = {
        id: tmdbId,
        media_type: "tv",
        title: metadata?.title || item.show.title,
        poster_path: metadata?.posterPath || null,
        first_air_date: metadata?.releaseDate || null,
        addedAt: new Date(item.listed_at).getTime(),
      }
      totalItems++
    }

    if (Object.keys(watchlistItems).length > 0) {
      batch.set(
        adminDb.doc(`users/${userId}/lists/watchlist`),
        {
          name: "Should Watch",
          items: watchlistItems,
          updatedAt: Date.now(),
        },
        { merge: true },
      )
    }

    // Sync movie history to "Already Watched" list
    const alreadyWatchedItems: Record<string, unknown> = {}
    for (const item of movieHistory) {
      if (item.type !== "movie" || !item.movie?.ids.tmdb) continue

      const tmdbId = item.movie.ids.tmdb
      // Skip if already in the map (we only want the first watch)
      if (alreadyWatchedItems[String(tmdbId)]) continue

      const metadata = await getTmdbMetadata(tmdbId, "movie")

      alreadyWatchedItems[String(tmdbId)] = {
        id: tmdbId,
        media_type: "movie",
        title: metadata?.title || item.movie.title,
        poster_path: metadata?.posterPath || null,
        release_date: metadata?.releaseDate || null,
        addedAt: new Date(item.watched_at).getTime(),
      }
      totalItems++
    }

    if (Object.keys(alreadyWatchedItems).length > 0) {
      batch.set(
        adminDb.doc(`users/${userId}/lists/already-watched`),
        {
          name: "Already Watched",
          items: alreadyWatchedItems,
          updatedAt: Date.now(),
        },
        { merge: true },
      )
    }

    // Commit all changes
    await batch.commit()

    // Update last sync time on user document
    await adminDb.doc(`users/${userId}`).update({
      traktLastSyncAt: new Date(),
    })

    return NextResponse.json({
      success: true,
      totalItems,
      details: {
        movieRatings: movieRatings.length,
        showRatings: showRatings.length,
        episodeRatings: episodeRatings.length,
        watchlist: movieWatchlist.length + showWatchlist.length,
        history: Object.keys(alreadyWatchedItems).length,
      },
    })
  } catch (error) {
    console.error("Trakt sync error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Sync failed",
      },
      { status: 500 },
    )
  }
}
