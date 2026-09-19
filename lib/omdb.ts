import "server-only"

import { tmdbFetch } from "@/lib/tmdb"
import type { ExternalRatings } from "@/types/external-ratings"
import { unstable_cache } from "next/cache"

const OMDB_BASE_URL = "https://www.omdbapi.com/"
const OMDB_REVALIDATE_SECONDS = 24 * 60 * 60 // 24 hours
const OMDB_TIMEOUT_MS = 10_000

type MediaType = "movie" | "tv"

interface OMDbRating {
  Source: string
  Value: string
}

interface OMDbResponse {
  imdbRating?: string
  imdbVotes?: string
  Ratings?: OMDbRating[]
  Response: "True" | "False"
  Error?: string
}

interface TMDBExternalIdsResponse {
  imdb_id: string | null
}

type OmdbFailureKind = "rate-limited" | "not-found" | "http" | "network"

/**
 * Thrown for any OMDb failure so it bypasses the success-only
 * `unstable_cache` below — thrown values are never cached, which keeps a
 * miss (especially rate-limiting) from freezing the rail for 24 hours.
 */
class OmdbError extends Error {
  kind: OmdbFailureKind

  constructor(kind: OmdbFailureKind, message: string) {
    super(message)
    this.kind = kind
  }
}

function isRateLimitError(message: string | undefined): boolean {
  return /request limit|rate limit|exceeded|quota/i.test(message ?? "")
}

/**
 * Fetches and parses OMDb ratings without caching. Only successful parses
 * resolve; every failure mode throws OmdbError.
 */
async function fetchOmdbRatingsUncached(
  imdbId: string,
): Promise<ExternalRatings> {
  const url = new URL(OMDB_BASE_URL)
  url.searchParams.set("apikey", getOmdbApiKey())
  url.searchParams.set("i", imdbId)

  const abortController = new AbortController()
  const timeoutId = setTimeout(() => abortController.abort(), OMDB_TIMEOUT_MS)
  let response: Response

  try {
    response = await fetch(url, {
      cache: "no-store",
      signal: abortController.signal,
    })
  } catch (error) {
    throw new OmdbError(
      "network",
      `OMDb request failed for ${imdbId}: ${error instanceof Error ? error.message : String(error)}`,
    )
  } finally {
    clearTimeout(timeoutId)
  }

  if (!response.ok) {
    throw new OmdbError(
      "http",
      `OMDb responded with status ${response.status} for ${imdbId}`,
    )
  }

  const data = (await response.json()) as OMDbResponse
  if (data.Response === "False") {
    if (isRateLimitError(data.Error)) {
      throw new OmdbError(
        "rate-limited",
        `OMDb rate limit reached (${data.Error ?? "no detail"})`,
      )
    }
    throw new OmdbError(
      "not-found",
      `OMDb has no data for ${imdbId}: ${data.Error ?? "unknown error"}`,
    )
  }

  const ratings = parseExternalRatings(data)
  if (!hasAnyExternalRatings(ratings)) {
    throw new OmdbError(
      "not-found",
      `OMDb returned no usable ratings for ${imdbId}`,
    )
  }
  return ratings
}

/**
 * Success-only cache: resolved ratings are cached for 24 hours per IMDb ID;
 * OmdbError rejections propagate uncached.
 */
const getCachedOmdbRatings = unstable_cache(
  fetchOmdbRatingsUncached,
  ["omdb-external-ratings"],
  { revalidate: OMDB_REVALIDATE_SECONDS },
)

function getOmdbApiKey(): string {
  return process.env.OMDB_API_KEY?.trim() ?? ""
}

export function parseExternalRatings(response: OMDbResponse): ExternalRatings {
  const ratings: ExternalRatings = {
    imdb: null,
    rottenTomatoes: null,
    metacritic: null,
  }

  if (response.imdbRating && response.imdbRating !== "N/A") {
    ratings.imdb = {
      rating: response.imdbRating,
      votes:
        response.imdbVotes && response.imdbVotes !== "N/A"
          ? response.imdbVotes
          : "",
    }
  }

  for (const rating of Array.isArray(response.Ratings) ? response.Ratings : []) {
    if (rating.Source === "Rotten Tomatoes" && rating.Value !== "N/A") {
      ratings.rottenTomatoes = rating.Value
    }

    if (rating.Source === "Metacritic" && rating.Value !== "N/A") {
      ratings.metacritic = rating.Value
    }
  }

  return ratings
}

export function hasAnyExternalRatings(
  ratings: ExternalRatings | null,
): ratings is ExternalRatings {
  return !!(ratings?.imdb || ratings?.rottenTomatoes || ratings?.metacritic)
}

async function getImdbId(
  mediaType: MediaType,
  mediaId: number,
): Promise<string | null> {
  const endpoint =
    mediaType === "movie"
      ? `/movie/${mediaId}/external_ids`
      : `/tv/${mediaId}/external_ids`

  const response = await tmdbFetch(endpoint, {
    next: { revalidate: OMDB_REVALIDATE_SECONDS },
  })

  if (!response.ok) {
    return null
  }

  const data = (await response.json()) as TMDBExternalIdsResponse
  return data.imdb_id?.trim() || null
}

async function fetchOmdbExternalRatings(
  imdbId: string,
): Promise<ExternalRatings | null> {
  try {
    return await getCachedOmdbRatings(imdbId)
  } catch (error) {
    if (error instanceof OmdbError && error.kind === "rate-limited") {
      // Never cached (thrown values bypass unstable_cache): the next visit
      // retries instead of serving a frozen miss for 24 hours.
      console.warn(`[omdb] Rate limit reached for ${imdbId}; skipping cache`)
    } else if (error instanceof OmdbError) {
      console.debug(`[omdb] Ratings unavailable for ${imdbId}: ${error.message}`)
    } else {
      console.error(`[omdb] Unexpected error for ${imdbId}:`, error)
    }
    return null
  }
}

export async function getMediaExternalRatings(
  mediaType: MediaType,
  mediaId: number,
): Promise<ExternalRatings | null> {
  if (!getOmdbApiKey()) {
    console.error("[omdb] OMDB_API_KEY is not configured; skipping external ratings")
    return null
  }

  if (!Number.isFinite(mediaId)) {
    console.warn(`[omdb] Refusing external ratings lookup for non-finite id: ${mediaId}`)
    return null
  }

  try {
    const imdbId = await getImdbId(mediaType, mediaId)
    if (!imdbId) {
      console.debug(
        `[omdb] No IMDb ID for ${mediaType}/${mediaId}; skipping OMDb lookup`,
      )
      return null
    }

    return await fetchOmdbExternalRatings(imdbId)
  } catch (error) {
    console.error(
      `[omdb] Unexpected error fetching ratings for ${mediaType}/${mediaId}:`,
      error,
    )
    return null
  }
}
