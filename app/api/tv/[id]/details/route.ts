import { getTVDetails } from "@/lib/tmdb"
import { NextResponse } from "next/server"

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/tv/[id]/details
 * Fetches TV show details from TMDB
 */
export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params
  const tvId = parseInt(id, 10)

  if (isNaN(tvId)) {
    return NextResponse.json({ error: "Invalid TV show ID" }, { status: 400 })
  }

  const details = await getTVDetails(tvId)

  if (!details) {
    return NextResponse.json({ error: "TV show not found" }, { status: 404 })
  }

  // Return fields needed for progress calculation including seasons
  return NextResponse.json({
    id: details.id,
    name: details.name,
    number_of_episodes: details.number_of_episodes,
    episode_run_time: details.episode_run_time,
    status: details.status,
    seasons:
      details.seasons?.map((s) => ({
        season_number: s.season_number,
        episode_count: s.episode_count,
        air_date: s.air_date,
      })) || [],
  })
}
