"use server"

import {
  getBestTrailer,
  getWatchProviderList,
  getWatchProviders,
  getMediaImages,
  getMediaVideos,
  getMovieDetails,
  getRecommendations,
  getReviews,
  getSeasonDetails,
  getTVDetails,
} from "@/lib/tmdb"
import type { SupportedRegionCode } from "@/lib/regions"
import type { WatchProvider } from "@/types/tmdb"

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
        details.seasons?.map((season) => ({
          season_number: season.season_number,
          episode_count: season.episode_count,
          air_date: season.air_date || null,
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
 * Server action to fetch regional watch providers for one media item.
 */
export async function fetchWatchProviders(
  mediaId: number,
  mediaType: "movie" | "tv",
  region: SupportedRegionCode,
) {
  try {
    return await getWatchProviders(mediaId, mediaType, region)
  } catch (error) {
    console.error("Server Action: Failed to fetch watch providers", error)
    return null
  }
}

/**
 * Server action to fetch the regional watch provider catalog.
 */
export async function fetchWatchProviderCatalog(
  mediaType: "movie" | "tv",
  region: SupportedRegionCode,
): Promise<WatchProvider[]> {
  try {
    const providers = await getWatchProviderList(mediaType, region)

    return providers
      .map((provider) => ({
        display_priority: provider.display_priorities?.[region] ?? 999,
        logo_path: provider.logo_path,
        provider_id: provider.provider_id,
        provider_name: provider.provider_name,
      }))
      .sort((a, b) => a.display_priority - b.display_priority)
  } catch (error) {
    console.error(
      "Server Action: Failed to fetch watch provider catalog",
      error,
    )
    return []
  }
}

/**
 * Fetch movie details for enrichment
 * Used by ratings page to get poster and title info
 */
export async function fetchMovieDetails(movieId: number) {
  try {
    return await getMovieDetails(movieId)
  } catch (error) {
    console.error("Server Action: Failed to fetch movie details", error)
    return null
  }
}

/**
 * Fetch full TV show details for enrichment
 * Used by ratings page to get poster and title info
 */
export async function fetchFullTVDetails(tvId: number) {
  try {
    return await getTVDetails(tvId)
  } catch (error) {
    console.error("Server Action: Failed to fetch TV details", error)
    return null
  }
}
