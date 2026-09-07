import { tmdbFetch } from "@/lib/tmdb"
import { NextResponse } from "next/server"

const TRAKT_API_BASE = "https://api.trakt.tv"
const TRAKT_API_VERSION = "2"

interface TMDBExternalIdsResponse {
  imdb_id: string | null
}

interface TraktSearchResult {
  type: "movie" | "show"
  movie?: { ids: { slug: string } }
  show?: { ids: { slug: string } }
}

/**
 * GET /api/open-with?mediaType=movie|tv&mediaId=123
 * Resolves direct-link IDs (IMDb ID, Trakt slug) for the "Open with" menu.
 *
 * All upstream fetches use `cache: "no-store"` so this route never reads or
 * writes the Workers KV incremental cache — it adds zero K2 usage. Called
 * lazily from the browser only when the user opens the menu.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const mediaType = searchParams.get("mediaType")
  const mediaId = Number.parseInt(searchParams.get("mediaId") ?? "", 10)

  if ((mediaType !== "movie" && mediaType !== "tv") || !Number.isFinite(mediaId)) {
    return NextResponse.json(
      { error: "Invalid mediaType or mediaId" },
      { status: 400 },
    )
  }

  const [imdbId, traktSlug] = await Promise.all([
    getImdbId(mediaType, mediaId),
    getTraktSlug(mediaType, mediaId),
  ])

  return NextResponse.json({ imdbId, traktSlug })
}

async function getImdbId(
  mediaType: "movie" | "tv",
  mediaId: number,
): Promise<string | null> {
  try {
    const endpoint =
      mediaType === "movie"
        ? `/movie/${mediaId}/external_ids`
        : `/tv/${mediaId}/external_ids`

    const response = await tmdbFetch(endpoint, { cache: "no-store" })

    if (!response.ok) {
      return null
    }

    const data = (await response.json()) as TMDBExternalIdsResponse
    return data.imdb_id?.trim() || null
  } catch {
    return null
  }
}

async function getTraktSlug(
  mediaType: "movie" | "tv",
  mediaId: number,
): Promise<string | null> {
  const clientId = process.env.TRAKT_CLIENT_ID?.trim()

  if (!clientId) {
    return null
  }

  const searchType = mediaType === "movie" ? "movie" : "show"

  try {
    const response = await fetch(
      `${TRAKT_API_BASE}/search/tmdb/${mediaId}?type=${searchType}`,
      {
        headers: {
          "Content-Type": "application/json",
          "trakt-api-key": clientId,
          "trakt-api-version": TRAKT_API_VERSION,
        },
        cache: "no-store",
      },
    )

    if (!response.ok) {
      return null
    }

    const data = (await response.json()) as TraktSearchResult[]
    const result = data[0]

    if (mediaType === "movie") {
      return result?.movie?.ids.slug ?? null
    }

    return result?.show?.ids.slug ?? null
  } catch {
    return null
  }
}
