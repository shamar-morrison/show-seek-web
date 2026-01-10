import { adminAuth, adminDb } from "@/lib/firebase/admin"
import {
  getHistory,
  getListItems,
  getRatings,
  getUserLists,
  getWatchlist,
  refreshAccessToken,
} from "@/lib/trakt"
import { FieldValue, Firestore, WriteBatch } from "firebase-admin/firestore"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export interface SyncResult {
  success: boolean
  movies: number
  shows: number
  episodes: number
  ratings: number
  lists: number
  favorites: number
  watchlist: number
}

/**
 * Helper class to manage Firestore batch writes with automatic chunking.
 * Firestore limits batches to 500 operations, so this class commits
 * automatically when that limit is reached.
 */
class BatchWriter {
  private batch: WriteBatch
  private operationCount = 0
  private readonly MAX_OPERATIONS = 500

  constructor(private db: Firestore) {
    this.batch = db.batch()
  }

  set(
    ref: FirebaseFirestore.DocumentReference,
    data: FirebaseFirestore.DocumentData,
    options?: FirebaseFirestore.SetOptions,
  ): void {
    if (options) {
      this.batch.set(ref, data, options)
    } else {
      this.batch.set(ref, data)
    }
    this.operationCount++
  }

  /**
   * Check if we've reached the operation limit and need to commit
   */
  shouldCommit(): boolean {
    return this.operationCount >= this.MAX_OPERATIONS
  }

  /**
   * Commit current batch if it has operations and reset for more writes
   */
  async commitIfNeeded(): Promise<void> {
    if (this.operationCount > 0) {
      await this.batch.commit()
      this.batch = this.db.batch()
      this.operationCount = 0
    }
  }

  /**
   * Final commit - commits any remaining operations
   */
  async commit(): Promise<void> {
    if (this.operationCount > 0) {
      await this.batch.commit()
    }
  }

  get count(): number {
    return this.operationCount
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
      try {
        const newTokens = await refreshAccessToken(refreshToken)
        accessToken = newTokens.access_token
        refreshToken = newTokens.refresh_token

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

    const result: SyncResult = {
      success: true,
      movies: 0,
      shows: 0,
      episodes: 0,
      ratings: 0,
      lists: 0,
      favorites: 0,
      watchlist: 0,
    }

    // Fetch all data from Trakt in parallel
    const [
      movieHistory,
      episodeHistory,
      movieRatings,
      showRatings,
      episodeRatings,
      movieWatchlist,
      showWatchlist,
      customLists,
    ] = await Promise.all([
      getHistory(accessToken, "movies", 1000),
      getHistory(accessToken, "episodes", 1000),
      getRatings(accessToken, "movies"),
      getRatings(accessToken, "shows"),
      getRatings(accessToken, "episodes"),
      getWatchlist(accessToken, "movies"),
      getWatchlist(accessToken, "shows"),
      getUserLists(accessToken),
    ])

    console.log("[SYNC] Raw counts from Trakt API:")
    console.log(`  - Movie history: ${movieHistory.length}`)
    console.log(`  - Episode history: ${episodeHistory.length}`)
    console.log(`  - Movie watchlist: ${movieWatchlist.length}`)
    console.log(`  - Show watchlist: ${showWatchlist.length}`)
    console.log(`  - Movie ratings: ${movieRatings.length}`)
    console.log(`  - Show ratings: ${showRatings.length}`)
    console.log(`  - Episode ratings: ${episodeRatings.length}`)

    // Use BatchWriter to automatically chunk commits at 500 operations
    const batchWriter = new BatchWriter(adminDb)

    // --- MOVIE HISTORY → already-watched list ---
    const alreadyWatchedItems: Record<string, unknown> = {}
    const seenMovies = new Set<number>()
    for (const item of movieHistory) {
      if (!item.movie?.ids.tmdb) continue
      const tmdbId = item.movie.ids.tmdb
      if (seenMovies.has(tmdbId)) continue
      seenMovies.add(tmdbId)

      alreadyWatchedItems[String(tmdbId)] = {
        id: tmdbId,
        media_type: "movie",
        title: item.movie.title,
        poster_path: null, // Will be enriched later
        release_date: null,
        addedAt: new Date(item.watched_at).getTime(),
      }
      result.movies++
    }

    if (Object.keys(alreadyWatchedItems).length > 0) {
      batchWriter.set(
        adminDb.doc(`users/${userId}/lists/already-watched`),
        {
          name: "Already Watched",
          items: alreadyWatchedItems,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      )
      if (batchWriter.shouldCommit()) await batchWriter.commitIfNeeded()
    }

    // --- EPISODE HISTORY → episode_tracking ---
    // Group episodes by show
    const showEpisodes = new Map<
      number,
      {
        show: { title: string; tmdbId: number }
        episodes: Map<string, unknown>
      }
    >()

    for (const item of episodeHistory) {
      if (!item.show?.ids.tmdb || !item.episode) continue
      const tvShowId = item.show.ids.tmdb
      const episodeKey = `${item.episode.season}_${item.episode.number}`

      if (!showEpisodes.has(tvShowId)) {
        showEpisodes.set(tvShowId, {
          show: { title: item.show.title, tmdbId: tvShowId },
          episodes: new Map(),
        })
      }

      const showData = showEpisodes.get(tvShowId)!
      if (!showData.episodes.has(episodeKey)) {
        showData.episodes.set(episodeKey, {
          episodeId: item.episode.ids.tmdb || 0,
          tvShowId,
          seasonNumber: item.episode.season,
          episodeNumber: item.episode.number,
          watchedAt: new Date(item.watched_at).getTime(),
          episodeName: item.episode.title,
          episodeAirDate: null,
        })
        result.episodes++
      }
    }

    result.shows = showEpisodes.size

    for (const [tvShowId, showData] of showEpisodes) {
      const episodesObj: Record<string, unknown> = {}
      for (const [key, episode] of showData.episodes) {
        episodesObj[key] = episode
      }

      batchWriter.set(
        adminDb.doc(`users/${userId}/episode_tracking/${tvShowId}`),
        {
          episodes: episodesObj,
          metadata: {
            tvShowName: showData.show.title,
            posterPath: null, // Will be enriched later
            lastUpdated: Date.now(),
          },
        },
        { merge: true },
      )
      if (batchWriter.shouldCommit()) await batchWriter.commitIfNeeded()
    }

    // --- RATINGS ---
    for (const item of movieRatings) {
      if (!item.movie?.ids.tmdb) continue
      const tmdbId = item.movie.ids.tmdb
      const docId = `movie-${tmdbId}`

      batchWriter.set(
        adminDb.doc(`users/${userId}/ratings/${docId}`),
        {
          id: tmdbId,
          mediaType: "movie",
          rating: item.rating,
          title: item.movie.title,
          posterPath: null,
          releaseDate: null,
          ratedAt: new Date(item.rated_at).getTime(),
        },
        { merge: true },
      )
      if (batchWriter.shouldCommit()) await batchWriter.commitIfNeeded()
      result.ratings++
    }

    for (const item of showRatings) {
      if (!item.show?.ids.tmdb) continue
      const tmdbId = item.show.ids.tmdb
      const docId = `tv-${tmdbId}`

      batchWriter.set(
        adminDb.doc(`users/${userId}/ratings/${docId}`),
        {
          id: tmdbId,
          mediaType: "tv",
          rating: item.rating,
          title: item.show.title,
          posterPath: null,
          releaseDate: null,
          ratedAt: new Date(item.rated_at).getTime(),
        },
        { merge: true },
      )
      if (batchWriter.shouldCommit()) await batchWriter.commitIfNeeded()
      result.ratings++
    }

    for (const item of episodeRatings) {
      if (!item.show?.ids.tmdb || !item.episode) continue
      const tvShowId = item.show.ids.tmdb
      const season = item.episode.season
      const episode = item.episode.number
      const docId = `episode-${tvShowId}-${season}-${episode}`

      batchWriter.set(
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
      if (batchWriter.shouldCommit()) await batchWriter.commitIfNeeded()
      result.ratings++
    }

    // --- WATCHLIST ---
    const watchlistItems: Record<string, unknown> = {}
    for (const item of movieWatchlist) {
      if (!item.movie?.ids.tmdb) {
        console.log(
          "[SYNC] Skipping movie watchlist item - no TMDB ID:",
          item.movie?.title,
        )
        continue
      }
      const tmdbId = item.movie.ids.tmdb

      watchlistItems[String(tmdbId)] = {
        id: tmdbId,
        media_type: "movie",
        title: item.movie.title,
        poster_path: null,
        release_date: null,
        addedAt: new Date(item.listed_at).getTime(),
      }
      result.watchlist++
    }

    for (const item of showWatchlist) {
      if (!item.show?.ids.tmdb) {
        console.log(
          "[SYNC] Skipping show watchlist item - no TMDB ID:",
          item.show?.title,
        )
        continue
      }
      const tmdbId = item.show.ids.tmdb

      watchlistItems[String(tmdbId)] = {
        id: tmdbId,
        media_type: "tv",
        title: item.show.title,
        poster_path: null,
        first_air_date: null,
        addedAt: new Date(item.listed_at).getTime(),
      }
      result.watchlist++
    }

    if (Object.keys(watchlistItems).length > 0) {
      batchWriter.set(
        adminDb.doc(`users/${userId}/lists/watchlist`),
        {
          name: "Should Watch",
          items: watchlistItems,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      )
      if (batchWriter.shouldCommit()) await batchWriter.commitIfNeeded()
    }

    // --- CUSTOM LISTS (including Favorites) ---
    console.log(
      "[SYNC] Custom lists from Trakt:",
      customLists.map((l) => l.name),
    )
    for (const list of customLists) {
      const listItems = await getListItems(accessToken, list.ids.slug)
      console.log(`[SYNC] List '${list.name}' has ${listItems.length} items`)
      const items: Record<string, unknown> = {}

      for (const item of listItems) {
        if (item.type === "movie" && item.movie?.ids.tmdb) {
          items[String(item.movie.ids.tmdb)] = {
            id: item.movie.ids.tmdb,
            media_type: "movie",
            title: item.movie.title,
            poster_path: null,
            release_date: null,
            addedAt: new Date(item.listed_at).getTime(),
          }
        } else if (item.type === "show" && item.show?.ids.tmdb) {
          items[String(item.show.ids.tmdb)] = {
            id: item.show.ids.tmdb,
            media_type: "tv",
            title: item.show.title,
            poster_path: null,
            first_air_date: null,
            addedAt: new Date(item.listed_at).getTime(),
          }
        }
      }

      if (Object.keys(items).length > 0) {
        // Check if this is the "Favorites" list
        const isFavorites = list.name.toLowerCase() === "favorites"
        const listId = isFavorites ? "favorites" : list.ids.slug

        batchWriter.set(
          adminDb.doc(`users/${userId}/lists/${listId}`),
          {
            name: list.name,
            items,
            updatedAt: FieldValue.serverTimestamp(),
            isCustom: !isFavorites,
          },
          { merge: true },
        )
        if (batchWriter.shouldCommit()) await batchWriter.commitIfNeeded()

        if (isFavorites) {
          result.favorites = Object.keys(items).length
        } else {
          result.lists++
        }
      }
    }

    // Commit any remaining operations
    await batchWriter.commit()

    // Update last sync time and sync result on user document
    await adminDb.doc(`users/${userId}`).update({
      traktLastSyncAt: FieldValue.serverTimestamp(),
      traktLastSyncResult: result,
    })

    return NextResponse.json(result)
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
