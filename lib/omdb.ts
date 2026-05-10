import "server-only"

import { tmdbFetch } from "@/lib/tmdb"
import type { ExternalRatings } from "@/types/external-ratings"

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
  const apiKey = getOmdbApiKey()
  if (!apiKey) {
    return null
  }

  const url = new URL(OMDB_BASE_URL)
  url.searchParams.set("apikey", apiKey)
  url.searchParams.set("i", imdbId)

  const abortController = new AbortController()
  const timeoutId = setTimeout(() => abortController.abort(), OMDB_TIMEOUT_MS)
  let response: Response

  try {
    response = await fetch(url, {
      next: { revalidate: OMDB_REVALIDATE_SECONDS },
      signal: abortController.signal,
    })
  } finally {
    clearTimeout(timeoutId)
  }

  if (!response.ok) {
    return null
  }

  const data = (await response.json()) as OMDbResponse
  if (data.Response === "False") {
    return null
  }

  const ratings = parseExternalRatings(data)
  return hasAnyExternalRatings(ratings) ? ratings : null
}

export async function getMediaExternalRatings(
  mediaType: MediaType,
  mediaId: number,
): Promise<ExternalRatings | null> {
  if (!getOmdbApiKey() || !Number.isFinite(mediaId)) {
    return null
  }

  try {
    const imdbId = await getImdbId(mediaType, mediaId)
    if (!imdbId) {
      return null
    }

    return await fetchOmdbExternalRatings(imdbId)
  } catch {
    return null
  }
}
