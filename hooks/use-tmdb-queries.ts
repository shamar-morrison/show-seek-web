"use client"

import {
  fetchMediaImages,
  fetchMediaVideos,
  fetchRecommendations,
  fetchReviews,
} from "@/app/actions"
import type { TMDBLogo, TMDBMedia, TMDBReview, TMDBVideo } from "@/types/tmdb"
import { useQuery } from "@tanstack/react-query"

/**
 * Query keys for TMDB data
 * Centralized to ensure consistent cache key usage
 */
export const tmdbQueryKeys = {
  tvShowDetails: (tvShowId: number) => ["tv", tvShowId, "details"] as const,
  seasonEpisodes: (tvShowId: number, seasonNumber: number) =>
    ["tv", tvShowId, "season", seasonNumber] as const,
  mediaImages: (mediaId: number, mediaType: "movie" | "tv") =>
    [mediaType, mediaId, "images"] as const,
  mediaVideos: (mediaId: number, mediaType: "movie" | "tv") =>
    [mediaType, mediaId, "videos"] as const,
  mediaReviews: (mediaId: number, mediaType: "movie" | "tv") =>
    [mediaType, mediaId, "reviews"] as const,
  recommendations: (mediaId: number, mediaType: "movie" | "tv") =>
    [mediaType, mediaId, "recommendations"] as const,
}

interface TMDBShowData {
  totalEpisodes: number
  avgRuntime: number
  seasons: Array<{
    season_number: number
    episode_count: number
    air_date: string | null
  }>
}

interface TMDBEpisodeData {
  id: number
  episode_number: number
  name: string
  air_date: string | null
  runtime: number | null
}

/**
 * Hook to fetch TV show details for progress calculation
 */
export function useTVShowDetails(tvShowId: number, enabled = true) {
  return useQuery({
    queryKey: tmdbQueryKeys.tvShowDetails(tvShowId),
    queryFn: async (): Promise<TMDBShowData | null> => {
      const response = await fetch(`/api/tv/${tvShowId}/details`)
      if (!response.ok) return null
      const data = await response.json()
      const avgRuntime =
        data.episode_run_time?.length > 0 ? data.episode_run_time[0] : 45
      return {
        totalEpisodes: data.number_of_episodes || 0,
        avgRuntime,
        seasons: data.seasons || [],
      }
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
    queryKey: tmdbQueryKeys.seasonEpisodes(tvShowId, seasonNumber),
    queryFn: async (): Promise<TMDBEpisodeData[]> => {
      const response = await fetch(`/api/tv/${tvShowId}/season/${seasonNumber}`)
      if (!response.ok) return []
      const data = await response.json()
      return data.episodes || []
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
    queryKey: tmdbQueryKeys.recommendations(mediaId, mediaType),
    queryFn: async (): Promise<TMDBMedia[]> => {
      const data = await fetchRecommendations(mediaId, mediaType)
      return data || []
    },
    enabled,
  })
}
