"use client"

import {
  fetchMediaImages,
  fetchMediaVideos,
  fetchRecommendations,
  fetchReviews,
  fetchSeasonEpisodes,
  fetchTVShowDetails,
  type SeasonEpisodeData,
  type TVShowDetailsData,
} from "@/app/actions"
import { queryCacheProfiles } from "@/lib/react-query/query-options"
import { tmdbQueryKeys } from "@/lib/react-query/query-keys"
import type { TMDBLogo, TMDBMedia, TMDBReview, TMDBVideo } from "@/types/tmdb"
import { useQuery } from "@tanstack/react-query"

export { tmdbQueryKeys }

// QueryProvider defaults disable automatic refetching for Firestore-centric flows.
// Keep explicit TMDB overrides so public metadata refreshes on mount/focus.
const tmdbRefetchOptions = {
  refetchOnWindowFocus: true,
  refetchOnMount: true,
} as const

/**
 * Hook to fetch TV show details for progress calculation
 */
export function useTVShowDetails(tvShowId: number, enabled = true) {
  return useQuery({
    ...queryCacheProfiles.profile,
    ...tmdbRefetchOptions,
    queryKey: tmdbQueryKeys.tvShowDetails(tvShowId),
    queryFn: async (): Promise<TVShowDetailsData | null> => {
      return await fetchTVShowDetails(tvShowId)
    },
    enabled,
  })
}

/**
 * Hook to fetch season episodes
 */
export function useSeasonEpisodes(
  tvShowId: number,
  seasonNumber: number,
  enabled = true,
) {
  return useQuery({
    ...queryCacheProfiles.profile,
    ...tmdbRefetchOptions,
    queryKey: tmdbQueryKeys.seasonEpisodes(tvShowId, seasonNumber),
    queryFn: async (): Promise<SeasonEpisodeData[]> => {
      return await fetchSeasonEpisodes(tvShowId, seasonNumber)
    },
    enabled,
  })
}

/**
 * Hook to fetch media images (posters + backdrops)
 */
export function useMediaImages(
  mediaId: number,
  mediaType: "movie" | "tv",
  enabled = true,
) {
  return useQuery({
    ...queryCacheProfiles.profile,
    ...tmdbRefetchOptions,
    queryKey: tmdbQueryKeys.mediaImages(mediaId, mediaType),
    queryFn: async (): Promise<TMDBLogo[]> => {
      const data = await fetchMediaImages(mediaId, mediaType)
      if (!data) return []
      return [...(data.posters || []), ...(data.backdrops || [])]
    },
    enabled,
  })
}

/**
 * Hook to fetch media videos
 */
export function useMediaVideos(
  mediaId: number,
  mediaType: "movie" | "tv",
  enabled = true,
) {
  return useQuery({
    ...queryCacheProfiles.profile,
    ...tmdbRefetchOptions,
    queryKey: tmdbQueryKeys.mediaVideos(mediaId, mediaType),
    queryFn: async (): Promise<TMDBVideo[]> => {
      const data = await fetchMediaVideos(mediaId, mediaType)
      return data?.results || []
    },
    enabled,
  })
}

/**
 * Hook to fetch media reviews
 */
export function useMediaReviews(
  mediaId: number,
  mediaType: "movie" | "tv",
  enabled = true,
) {
  return useQuery({
    ...queryCacheProfiles.profile,
    ...tmdbRefetchOptions,
    queryKey: tmdbQueryKeys.mediaReviews(mediaId, mediaType),
    queryFn: async (): Promise<TMDBReview[]> => {
      const data = await fetchReviews(mediaId, mediaType)
      return data?.results || []
    },
    enabled,
  })
}

/**
 * Hook to fetch recommendations
 */
export function useRecommendations(
  mediaId: number,
  mediaType: "movie" | "tv",
  enabled = true,
) {
  return useQuery({
    ...queryCacheProfiles.profile,
    ...tmdbRefetchOptions,
    queryKey: tmdbQueryKeys.recommendations(mediaId, mediaType),
    queryFn: async (): Promise<TMDBMedia[]> => {
      const data = await fetchRecommendations(mediaId, mediaType)
      return data || []
    },
    enabled,
  })
}
