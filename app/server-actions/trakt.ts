"use server"

import { getTraktMediaComments } from "@/lib/trakt"

/**
 * Fetch Trakt reviews/comments for a media item.
 * Used for lazy-loading the Trakt reviews section.
 */
export async function fetchTraktReviews(
  mediaId: number,
  mediaType: "movie" | "tv",
) {
  try {
    return await getTraktMediaComments(mediaId, mediaType)
  } catch (error) {
    console.error("Server Action: Failed to fetch Trakt reviews", error)
    return []
  }
}
