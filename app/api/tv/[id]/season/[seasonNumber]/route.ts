import { NextResponse } from "next/server"

const TMDB_API_KEY = process.env.TMDB_API_KEY
const TMDB_BASE_URL = "https://api.themoviedb.org/3"

interface RouteParams {
  params: Promise<{ id: string; seasonNumber: string }>
}

/**
 * GET /api/tv/[id]/season/[seasonNumber]
 * Fetches season details including episodes from TMDB
 */
export async function GET(request: Request, { params }: RouteParams) {
  const { id, seasonNumber } = await params
  const tvId = parseInt(id, 10)
  const season = parseInt(seasonNumber, 10)

  if (isNaN(tvId) || isNaN(season)) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 })
  }

  if (!TMDB_API_KEY) {
    return NextResponse.json(
      { error: "TMDB API key not configured" },
      { status: 500 },
    )
  }

  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/tv/${tvId}/season/${season}?api_key=${TMDB_API_KEY}`,
      { next: { revalidate: 3600 } }, // Cache for 1 hour
    )

    if (!response.ok) {
      return NextResponse.json({ error: "Season not found" }, { status: 404 })
    }

    const data = await response.json()

    // Return simplified episode data
    return NextResponse.json({
      season_number: data.season_number,
      episodes:
        data.episodes?.map(
          (ep: {
            id: number
            episode_number: number
            name: string
            air_date: string | null
            runtime: number | null
          }) => ({
            id: ep.id,
            episode_number: ep.episode_number,
            name: ep.name,
            air_date: ep.air_date,
            runtime: ep.runtime,
          }),
        ) || [],
    })
  } catch (error) {
    console.error("Failed to fetch season details:", error)
    return NextResponse.json(
      { error: "Failed to fetch season" },
      { status: 500 },
    )
  }
}
