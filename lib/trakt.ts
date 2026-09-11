/**
 * Trakt API utilities
 * Provides functions for fetching data from Trakt.tv API
 */

import type { TraktComment } from "@/types/trakt"

const TRAKT_API_BASE = "https://api.trakt.tv"
const TRAKT_API_VERSION = "2"

/**
 * Trakt requires an identifying User-Agent on all API calls; requests
 * without one may be blocked by their WAF (403). See
 * https://docs.trakt.tv/docs/required-headers
 */
const TRAKT_USER_AGENT = "ShowSeek-web/1.0"

function buildTraktHeaders(clientId: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    "trakt-api-version": TRAKT_API_VERSION,
    "trakt-api-key": clientId,
    "User-Agent": TRAKT_USER_AGENT,
  }
}

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
 * Look up Trakt IDs from a TMDB ID
 * Trakt requires using their internal ID/slug for most endpoints.
 * Returns both the numeric Trakt ID (primary, mirrors the mobile app)
 * and the slug (fallback) since slugs can go stale when Trakt merges
 * duplicate entries for new releases.
 */
async function getTraktIdsFromTMDB(
  tmdbId: number,
  mediaType: "movie" | "tv",
  clientId: string,
): Promise<{ traktId: number; slug: string } | null> {
  const searchType = mediaType === "movie" ? "movie" : "show"
  const url = `${TRAKT_API_BASE}/search/tmdb/${tmdbId}?type=${searchType}`

  try {
    const response = await fetch(url, {
      headers: buildTraktHeaders(clientId),
      next: {
        revalidate: 86400, // Cache ID lookups for 24 hours
      },
    })

    if (!response.ok) {
      console.warn(
        `Trakt: ID lookup failed for TMDB ${tmdbId} - ${response.status}`,
      )
      return null
    }

    const data: TraktSearchResult[] = await response.json()
    if (data.length === 0) {
      return null
    }

    // Get the IDs from the first result
    const result = data[0]
    if (mediaType === "movie" && result.movie) {
      return { traktId: result.movie.ids.trakt, slug: result.movie.ids.slug }
    }
    if (mediaType === "tv" && result.show) {
      return { traktId: result.show.ids.trakt, slug: result.show.ids.slug }
    }

    return null
  } catch (error) {
    console.error("Trakt: Error looking up Trakt IDs", error)
    return null
  }
}

/**
 * Get comments/reviews for a movie or TV show from Trakt
 * Uses TMDB ID for lookup (first converts to the Trakt numeric ID,
 * with slug as fallback)
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

  // First, resolve the Trakt numeric ID from the TMDB ID (mirrors mobile).
  // The numeric ID is primary because slugs can 404 when Trakt merges
  // duplicate entries; the slug is kept as a fallback identifier.
  const ids = await getTraktIdsFromTMDB(tmdbId, mediaType, clientId)
  if (!ids) {
    return []
  }

  // Trakt uses "shows" for TV, "movies" for movies
  const mediaEndpoint = mediaType === "movie" ? "movies" : "shows"
  // Numeric ID first (mobile parity: sort=likes), slug as fallback.
  const identifiers = [String(ids.traktId), ids.slug].filter(
    (value, index, all) => value && all.indexOf(value) === index,
  )

  const headers = buildTraktHeaders(clientId)

  for (const identifier of identifiers) {
    const url = `${TRAKT_API_BASE}/${mediaEndpoint}/${identifier}/comments?sort=likes&extended=full`

    try {
      const response = await fetch(url, {
        headers,
        next: {
          revalidate: 3600, // Cache comments for 1 hour
        },
      })

      if (response.status === 404) {
        // Identifier may be stale (e.g. merged slug) - try the next one.
        continue
      }

      if (!response.ok) {
        throw new Error(`Trakt: Failed to fetch comments - ${response.status}`)
      }

      const data: TraktComment[] = await response.json()
      return data
    } catch (error) {
      // 404 fallthrough is handled above; anything else is a real failure.
      if (error instanceof Error && error.message.startsWith("Trakt:")) {
        throw error
      }
      console.error("Trakt: Error fetching comments", error)
      throw error instanceof Error
        ? error
        : new Error("Trakt: Error fetching comments")
    }
  }

  return []
}
