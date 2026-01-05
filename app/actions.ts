"use server"

import {
  getBestTrailer,
  getCollectionDetails,
  getMediaImages,
  getMediaVideos,
  getRecommendations,
  getReviews,
  multiSearch,
} from "@/lib/tmdb"

/**
 * Server action to search for media.
 * This wraps the server-only multiSearch function.
 */
export async function searchMedia(query: string) {
  try {
    return await multiSearch(query)
  } catch (error) {
    console.error("Server Action: Failed to search media", error)
    return { page: 1, results: [], total_pages: 0, total_results: 0 }
  }
}

/**
 * Server action to fetch a trailer for a specific media item.
 * This wraps the server-only getMediaVideos function and uses getBestTrailer.
 */
export async function fetchTrailerKey(
  mediaId: number,
  mediaType: "movie" | "tv",
) {
  try {
    const videos = await getMediaVideos(mediaId, mediaType)
    return getBestTrailer(videos)
  } catch (error) {
    console.error("Server Action: Failed to fetch trailer", error)
    return null
  }
}

/**
 * Server action to fetch media images (posters and backdrops).
 * Used for lazy-loading the photos section.
 */
export async function fetchMediaImages(
  mediaId: number,
  mediaType: "movie" | "tv",
) {
  try {
    return await getMediaImages(mediaId, mediaType)
  } catch (error) {
    console.error("Server Action: Failed to fetch media images", error)
    return null
  }
}

/**
 * Server action to fetch media videos.
 * Used for lazy-loading the videos section.
 */
export async function fetchMediaVideos(
  mediaId: number,
  mediaType: "movie" | "tv",
) {
  try {
    return await getMediaVideos(mediaId, mediaType)
  } catch (error) {
    console.error("Server Action: Failed to fetch media videos", error)
    return null
  }
}

/**
 * Server action to fetch recommendations.
 * Used for lazy-loading the recommendations section.
 */
export async function fetchRecommendations(
  mediaId: number,
  mediaType: "movie" | "tv",
) {
  try {
    return await getRecommendations(mediaId, mediaType)
  } catch (error) {
    console.error("Server Action: Failed to fetch recommendations", error)
    return []
  }
}

/**
 * Server action to fetch reviews.
 * Used for lazy-loading the reviews section.
 */
export async function fetchReviews(mediaId: number, mediaType: "movie" | "tv") {
  try {
    return await getReviews(mediaId, mediaType)
  } catch (error) {
    console.error("Server Action: Failed to fetch reviews", error)
    return null
  }
}

/**
 * Fetch collection details
 */
export async function fetchCollection(collectionId: number) {
  return await getCollectionDetails(collectionId)
}
