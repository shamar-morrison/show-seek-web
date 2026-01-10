import { adminAuth, adminDb } from "@/lib/firebase/admin"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

const TMDB_API_KEY = process.env.TMDB_API_KEY

interface TmdbMetadata {
  title: string
  posterPath: string | null
  releaseDate: string | null
  voteAverage: number | null
}

async function getTmdbMetadata(
  tmdbId: number,
  type: "movie" | "tv",
): Promise<TmdbMetadata | null> {
  try {
    const response = await fetch(
      `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_API_KEY}`,
    )
    if (!response.ok) return null

    const data = await response.json()
    return {
      title: data.title || data.name,
      posterPath: data.poster_path,
      releaseDate: data.release_date || data.first_air_date || null,
      voteAverage: data.vote_average || null,
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

    const decodedToken = await adminAuth.verifySessionCookie(
      sessionCookie,
      true,
    )
    const userId = decodedToken.uid

    let enrichedCount = 0

    // --- Enrich ratings ---
    const ratingsSnapshot = await adminDb
      .collection(`users/${userId}/ratings`)
      .where("posterPath", "==", null)
      .limit(50)
      .get()

    for (const doc of ratingsSnapshot.docs) {
      const data = doc.data()
      const mediaType = data.mediaType === "tv" ? "tv" : "movie"

      // Skip episodes - they don't have posters
      if (data.mediaType === "episode") continue

      const tmdbId = typeof data.id === "number" ? data.id : parseInt(data.id)
      if (isNaN(tmdbId)) continue

      const metadata = await getTmdbMetadata(tmdbId, mediaType)
      if (metadata?.posterPath) {
        await doc.ref.update({
          posterPath: metadata.posterPath,
          title: metadata.title || data.title,
          releaseDate: metadata.releaseDate,
          voteAverage: metadata.voteAverage,
        })
        enrichedCount++
      }
    }

    // --- Enrich lists ---
    const listsSnapshot = await adminDb
      .collection(`users/${userId}/lists`)
      .get()

    for (const listDoc of listsSnapshot.docs) {
      const listData = listDoc.data()
      const items = listData.items || {}
      let updated = false

      for (const [itemId, item] of Object.entries(items)) {
        const itemData = item as Record<string, unknown>
        if (itemData.poster_path !== null) continue

        const mediaType = itemData.media_type === "tv" ? "tv" : "movie"
        const tmdbId =
          typeof itemData.id === "number"
            ? itemData.id
            : parseInt(itemData.id as string)
        if (isNaN(tmdbId)) continue

        const metadata = await getTmdbMetadata(tmdbId, mediaType)
        if (metadata?.posterPath) {
          items[itemId] = {
            ...itemData,
            poster_path: metadata.posterPath,
            title: metadata.title || itemData.title,
            release_date: metadata.releaseDate,
            vote_average: metadata.voteAverage,
          }
          updated = true
          enrichedCount++
        }
      }

      if (updated) {
        await listDoc.ref.update({ items })
      }
    }

    // --- Enrich episode tracking ---
    const trackingSnapshot = await adminDb
      .collection(`users/${userId}/episode_tracking`)
      .get()

    for (const trackingDoc of trackingSnapshot.docs) {
      const data = trackingDoc.data()
      if (data.metadata?.posterPath) continue

      const tvShowId = parseInt(trackingDoc.id)
      if (isNaN(tvShowId)) continue

      const metadata = await getTmdbMetadata(tvShowId, "tv")
      if (metadata?.posterPath) {
        await trackingDoc.ref.update({
          "metadata.posterPath": metadata.posterPath,
          "metadata.tvShowName": metadata.title || data.metadata?.tvShowName,
        })
        enrichedCount++
      }
    }

    return NextResponse.json({
      success: true,
      enrichedCount,
    })
  } catch (error) {
    console.error("Trakt enrich error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Enrichment failed",
      },
      { status: 500 },
    )
  }
}
