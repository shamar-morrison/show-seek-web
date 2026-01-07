"use server"

import {
  getBestTrailer,
  getCollectionDetails,
  getMediaImages,
  getMediaVideos,
  getRecommendations,
  getReviews,
  getSeasonDetails,
  getTVDetails,
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

/** TV show details for progress calculation */
export interface TVShowDetailsData {
  totalEpisodes: number
  avgRuntime: number
  seasons: Array<{
    season_number: number
    episode_count: number
    air_date: string | null
  }>
}

/**
 * Server action to fetch TV show details for progress calculation.
 * Used for episode tracking and watch progress features.
 */
export async function fetchTVShowDetails(
  tvShowId: number,
): Promise<TVShowDetailsData | null> {
  try {
    const details = await getTVDetails(tvShowId)
    if (!details) return null

    const avgRuntime =
      details.episode_run_time && details.episode_run_time.length > 0
        ? details.episode_run_time[0]
        : 45

    return {
      totalEpisodes: details.number_of_episodes || 0,
      avgRuntime,
      seasons:
        details.seasons?.map((s) => ({
          season_number: s.season_number,
          episode_count: s.episode_count,
          air_date: s.air_date || null,
        })) || [],
    }
  } catch (error) {
    console.error("Server Action: Failed to fetch TV show details", error)
    return null
  }
}

/** Episode data for progress tracking */
export interface SeasonEpisodeData {
  id: number
  episode_number: number
  name: string
  air_date: string | null
  runtime: number | null
}

/**
 * Server action to fetch season episodes.
 * Used for episode tracking features.
 */
export async function fetchSeasonEpisodes(
  tvShowId: number,
  seasonNumber: number,
): Promise<SeasonEpisodeData[]> {
  try {
    const seasonData = await getSeasonDetails(tvShowId, seasonNumber)
    return seasonData?.episodes || []
  } catch (error) {
    console.error("Server Action: Failed to fetch season episodes", error)
    return []
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
