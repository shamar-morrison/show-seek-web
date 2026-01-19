/**
 * Trakt API utilities
 * Provides functions for fetching data from Trakt.tv API
 */

import type { TraktComment } from "@/types/trakt"

const TRAKT_API_BASE = "https://api.trakt.tv"
const TRAKT_API_VERSION = "2"

interface TraktSearchResult {
  type: "movie" | "show"
  score: number
  movie?: {
    ids: {
      trakt: number
      slug: string
      imdb: string
      tmdb: number
    }
  }
  show?: {
    ids: {
      trakt: number
      slug: string
      imdb: string
      tmdb: number
    }
  }
}

/**
 * Look up a Trakt slug from a TMDB ID
 * Trakt requires using their internal slug/ID for most endpoints
 */
async function getTraktSlugFromTMDB(
  tmdbId: number,
  mediaType: "movie" | "tv",
  clientId: string,
): Promise<string | null> {
  const searchType = mediaType === "movie" ? "movie" : "show"
  const url = `${TRAKT_API_BASE}/search/tmdb/${tmdbId}?type=${searchType}`

  try {
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        "trakt-api-key": clientId,
        "trakt-api-version": TRAKT_API_VERSION,
      },
      next: {
        revalidate: 86400, // Cache slug lookups for 24 hours
      },
    })

    if (!response.ok) {
      return null
    }

    const data: TraktSearchResult[] = await response.json()
    if (data.length === 0) {
      return null
    }

    // Get the slug from the first result
    const result = data[0]
    if (mediaType === "movie" && result.movie) {
      return result.movie.ids.slug
    }
    if (mediaType === "tv" && result.show) {
      return result.show.ids.slug
    }

    return null
  } catch (error) {
    console.error("Trakt: Error looking up slug", error)
    return null
  }
}

/**
 * Get comments/reviews for a movie or TV show from Trakt
 * Uses TMDB ID for lookup (first converts to Trakt slug)
 *
 * @param tmdbId - The TMDB ID of the media
 * @param mediaType - Either "movie" or "tv"
 * @returns Array of Trakt comments/reviews
 */
export async function getTraktMediaComments(
  tmdbId: number,
  mediaType: "movie" | "tv",
): Promise<TraktComment[]> {
  const clientId = process.env.TRAKT_CLIENT_ID

  if (!clientId) {
    console.error("Trakt: TRAKT_CLIENT_ID not configured")
    return []
  }

  // First, look up the Trakt slug from the TMDB ID
  const slug = await getTraktSlugFromTMDB(tmdbId, mediaType, clientId)
  if (!slug) {
    return []
  }

  // Trakt uses "shows" for TV, "movies" for movies
  const mediaEndpoint = mediaType === "movie" ? "movies" : "shows"
  const url = `${TRAKT_API_BASE}/${mediaEndpoint}/${slug}/comments?extended=full`

  try {
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        "trakt-api-key": clientId,
        "trakt-api-version": TRAKT_API_VERSION,
      },
      next: {
        revalidate: 3600, // Cache comments for 1 hour
      },
    })

    if (!response.ok) {
      // 404 is expected for media not found on Trakt
      if (response.status === 404) {
        return []
      }
      console.error(`Trakt: Failed to fetch comments - ${response.status}`)
      return []
    }

    const data: TraktComment[] = await response.json()
    return data
  } catch (error) {
    console.error("Trakt: Error fetching comments", error)
    return []
  }
}
