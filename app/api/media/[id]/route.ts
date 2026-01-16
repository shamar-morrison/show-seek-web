import { getMovieDetails, getTVDetails } from "@/lib/tmdb"
import { NextRequest, NextResponse } from "next/server"

/**
 * GET /api/media/[id]?type=movie|tv
 * Fetches detailed media information for preview cards.
 * Returns the same data structure as getMovieDetails/getTVDetails.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const mediaId = parseInt(id, 10)

  if (isNaN(mediaId)) {
    return NextResponse.json({ error: "Invalid media ID" }, { status: 400 })
  }

  const { searchParams } = new URL(request.url)
  const mediaType = searchParams.get("type")

  if (mediaType !== "movie" && mediaType !== "tv") {
    return NextResponse.json(
      { error: "Invalid type parameter. Must be 'movie' or 'tv'" },
      { status: 400 },
    )
  }

  try {
    const data =
      mediaType === "movie"
        ? await getMovieDetails(mediaId)
        : await getTVDetails(mediaId)

    if (!data) {
      return NextResponse.json({ error: "Media not found" }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error fetching media details:", error)
    return NextResponse.json(
      { error: "Failed to fetch media details" },
      { status: 500 },
    )
  }
}
