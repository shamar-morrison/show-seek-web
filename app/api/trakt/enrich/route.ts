import { adminAuth, adminDb } from "@/lib/firebase/admin"
import { FieldValue } from "firebase-admin/firestore"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

const TMDB_API_KEY = process.env.TMDB_API_KEY
const FETCH_TIMEOUT_MS = 10000

// Chunk size for parallel TMDB requests (~5 requests at a time to stay under 40/10s rate limit)
const TMDB_CHUNK_SIZE = 5
// Maximum items to process per section to prevent timeout/memory issues
const MAX_RATINGS_ITEMS = 50
const MAX_LIST_ITEMS_PER_LIST = 50
const MAX_LISTS = 10
const MAX_EPISODE_TRACKING_ITEMS = 100

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
      { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
    )
    if (!response.ok) return null

    const data = await response.json()
    return {
      title: data.title || data.name,
      posterPath: data.poster_path ?? null,
      releaseDate: data.release_date || data.first_air_date || null,
      // Use ?? to preserve 0 values (|| would turn 0 into null)
      voteAverage: data.vote_average ?? null,
    }
  } catch {
    return null
  }
}

/**
 * Process items in chunks with controlled parallelism to respect TMDB rate limits
 */
async function processInChunks<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  chunkSize: number,
): Promise<R[]> {
  const results: R[] = []
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize)
    const chunkResults = await Promise.all(chunk.map(processor))
    results.push(...chunkResults)
  }
  return results
}

export async function POST() {
  try {
    // Get session cookie
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get("session")?.value

    if (!sessionCookie || !adminAuth || !adminDb) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Fail fast if TMDB_API_KEY is not configured
    if (!TMDB_API_KEY) {
      return NextResponse.json(
        { error: "TMDB_API_KEY is not configured" },
        { status: 500 },
      )
    }

    const decodedToken = await adminAuth.verifySessionCookie(
      sessionCookie,
      true,
    )
    const userId = decodedToken.uid

    // --- Rate limiting: 2-minute cooldown between enrichments ---
    const ENRICH_COOLDOWN_MS = 2 * 60 * 1000 // 2 minutes
    const userDoc = await adminDb.doc(`users/${userId}`).get()
    const userData = userDoc.data()

    if (userData) {
      const lastEnrichRaw = userData.traktLastEnrichAt
      let lastEnrichMs = 0
      if (typeof lastEnrichRaw?.toMillis === "function") {
        lastEnrichMs = lastEnrichRaw.toMillis()
      } else if (lastEnrichRaw instanceof Date) {
        lastEnrichMs = lastEnrichRaw.getTime()
      } else if (typeof lastEnrichRaw === "number") {
        lastEnrichMs = lastEnrichRaw
      }

      const timeSinceLastEnrich = Date.now() - lastEnrichMs
      if (lastEnrichMs > 0 && timeSinceLastEnrich < ENRICH_COOLDOWN_MS) {
        const retryAfterSeconds = Math.ceil(
          (ENRICH_COOLDOWN_MS - timeSinceLastEnrich) / 1000,
        )
        return NextResponse.json(
          {
            error: "Enrich rate limit exceeded",
            retryAfter: retryAfterSeconds,
            message: `Please wait ${retryAfterSeconds} seconds before enriching again`,
          },
          {
            status: 429,
            headers: { "Retry-After": String(retryAfterSeconds) },
          },
        )
      }
    }

    let enrichedCount = 0

    // --- Enrich ratings with controlled parallelism ---
    const ratingsSnapshot = await adminDb
      .collection(`users/${userId}/ratings`)
      .where("posterPath", "==", null)
      .limit(MAX_RATINGS_ITEMS)
      .get()

    // Filter and prepare rating docs for enrichment
    const ratingDocsToEnrich = ratingsSnapshot.docs.filter((doc) => {
      const data = doc.data()
      if (data.mediaType === "episode") return false
      const tmdbId = typeof data.id === "number" ? data.id : parseInt(data.id)
      return !isNaN(tmdbId)
    })

    // Process ratings in parallel chunks
    const ratingUpdates = await processInChunks(
      ratingDocsToEnrich,
      async (doc) => {
        const data = doc.data()
        const mediaType = data.mediaType === "tv" ? "tv" : "movie"
        const tmdbId = typeof data.id === "number" ? data.id : parseInt(data.id)

        const metadata = await getTmdbMetadata(tmdbId, mediaType)
        if (metadata?.posterPath) {
          return {
            ref: doc.ref,
            update: {
              posterPath: metadata.posterPath,
              title: metadata.title || data.title,
              releaseDate: metadata.releaseDate,
              voteAverage: metadata.voteAverage,
            },
          }
        }
        return null
      },
      TMDB_CHUNK_SIZE,
    )

    // Batch write rating updates
    const validRatingUpdates = ratingUpdates.filter(Boolean)
    if (validRatingUpdates.length > 0) {
      const batch = adminDb.batch()
      for (const update of validRatingUpdates) {
        if (update) {
          batch.update(update.ref, update.update)
          enrichedCount++
        }
      }
      await batch.commit()
    }

    // --- Enrich lists with limits and controlled parallelism ---
    const listsSnapshot = await adminDb
      .collection(`users/${userId}/lists`)
      .limit(MAX_LISTS)
      .get()

    for (const listDoc of listsSnapshot.docs) {
      const listData = listDoc.data()
      const items = listData.items || {}

      // Filter items that need enrichment and limit count
      const itemsToEnrich = Object.entries(items)
        .filter(([, item]) => {
          const itemData = item as Record<string, unknown>
          const poster = itemData["poster_path"]
          if (poster != null) return false
          const rawId = itemData["id"]
          const tmdbId =
            typeof rawId === "number" ? rawId : parseInt(rawId as string)
          return !isNaN(tmdbId)
        })
        .slice(0, MAX_LIST_ITEMS_PER_LIST)

      if (itemsToEnrich.length === 0) continue

      // Process list items in parallel chunks
      const itemUpdates = await processInChunks(
        itemsToEnrich,
        async ([itemId, item]) => {
          const itemData = item as Record<string, unknown>
          const mediaType = itemData["media_type"] === "tv" ? "tv" : "movie"
          const rawId = itemData["id"]
          const tmdbId =
            typeof rawId === "number" ? rawId : parseInt(rawId as string)

          const metadata = await getTmdbMetadata(tmdbId, mediaType)
          if (metadata?.posterPath) {
            return {
              itemId,
              enrichedData: {
                ...itemData,
                poster_path: metadata.posterPath,
                title: metadata.title || itemData["title"],
                release_date: metadata.releaseDate,
                vote_average: metadata.voteAverage,
              },
            }
          }
          return null
        },
        TMDB_CHUNK_SIZE,
      )

      // Apply updates to items object
      const validItemUpdates = itemUpdates.filter(Boolean)
      if (validItemUpdates.length > 0) {
        for (const update of validItemUpdates) {
          if (update) {
            items[update.itemId] = update.enrichedData
            enrichedCount++
          }
        }
        await listDoc.ref.update({ items })
      }
    }

    // --- Enrich episode tracking with limits and controlled parallelism ---
    const trackingSnapshot = await adminDb
      .collection(`users/${userId}/episode_tracking`)
      .limit(MAX_EPISODE_TRACKING_ITEMS)
      .get()

    // Filter docs that need enrichment
    const trackingDocsToEnrich = trackingSnapshot.docs.filter((doc) => {
      const data = doc.data()
      if (data.metadata?.posterPath) return false
      const tvShowId = parseInt(doc.id)
      return !isNaN(tvShowId)
    })

    // Process tracking docs in parallel chunks
    const trackingUpdates = await processInChunks(
      trackingDocsToEnrich,
      async (trackingDoc) => {
        const data = trackingDoc.data()
        const tvShowId = parseInt(trackingDoc.id)

        const metadata = await getTmdbMetadata(tvShowId, "tv")
        if (metadata?.posterPath) {
          return {
            ref: trackingDoc.ref,
            update: {
              "metadata.posterPath": metadata.posterPath,
              "metadata.tvShowName":
                metadata.title || data.metadata?.tvShowName,
            },
          }
        }
        return null
      },
      TMDB_CHUNK_SIZE,
    )

    // Batch write tracking updates
    const validTrackingUpdates = trackingUpdates.filter(Boolean)
    if (validTrackingUpdates.length > 0) {
      const batch = adminDb.batch()
      for (const update of validTrackingUpdates) {
        if (update) {
          batch.update(update.ref, update.update)
          enrichedCount++
        }
      }
      await batch.commit()
    }

    // Update last enrich timestamp for rate limiting
    await adminDb.doc(`users/${userId}`).update({
      traktLastEnrichAt: FieldValue.serverTimestamp(),
    })

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
