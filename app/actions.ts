"use server"

import { getMediaVideos } from "@/lib/tmdb"

/**
 * Server action to fetch a trailer for a specific media item.
 * This wraps the server-only getMediaVideos function.
 */
export async function fetchTrailerKey(
  mediaId: number,
  mediaType: "movie" | "tv",
) {
  try {
    const videos = await getMediaVideos(mediaId, mediaType)

    if (!videos || !videos.results) return null

    // Logic to find the best trailer (matches lib/tmdb.ts logic)
    const youtubeVideos = videos.results.filter(
      (v) => v.site === "YouTube" && v.key,
    )

    const trailer =
      youtubeVideos.find((v) => v.type === "Trailer" && v.official) ||
      youtubeVideos.find((v) => v.type === "Trailer") ||
      youtubeVideos.find((v) => v.type === "Teaser") ||
      youtubeVideos[0]

    return trailer?.key || null
  } catch (error) {
    console.error("Server Action: Failed to fetch trailer", error)
    return null
  }
}
