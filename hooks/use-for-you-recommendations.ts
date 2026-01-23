"use client"

import {
  fetchDiscoverHiddenGems,
  fetchRecommendations,
  fetchTrendingWeek,
} from "@/app/actions"
import { useAuth } from "@/context/auth-context"
import { useRatings } from "@/hooks/use-ratings"
import type { TMDBMedia } from "@/types/tmdb"
import { useQueries, useQuery } from "@tanstack/react-query"
import { useMemo } from "react"

/** Minimum rating threshold to be considered a "loved" item */
const MIN_RATING_THRESHOLD = 8

/** Maximum number of seed items to use for recommendations */
const MAX_SEEDS = 5

/** Seed item extracted from user ratings */
interface Seed {
  id: number
  mediaType: "movie" | "tv"
  title: string
}

/** A recommendation section with seed media and results */
export interface RecommendationSection {
  seed: Seed
  recommendations: TMDBMedia[]
  isLoading: boolean
}

/**
 * Hook for personalized "For You" recommendations.
 * Extracts highly-rated items as seeds and fetches recommendations for each.
 * Includes hidden gems and trending fallback for users with limited data.
 */
export function useForYouRecommendations() {
  const { user, loading: isAuthLoading } = useAuth()
  const { ratings, loading: isLoadingRatings } = useRatings()

  const isGuest = !isAuthLoading && (!user || user.isAnonymous)

  // Extract seeds from highly-rated movies/TV shows
  const seeds = useMemo((): Seed[] => {
    if (isGuest || ratings.size === 0) return []

    return Array.from(ratings.values())
      .filter(
        (r) => r.rating >= MIN_RATING_THRESHOLD && r.mediaType !== "episode",
      )
      .sort((a, b) => b.ratedAt - a.ratedAt)
      .slice(0, MAX_SEEDS)
      .map((r) => ({
        id: Number(r.mediaId),
        mediaType: r.mediaType as "movie" | "tv",
        title: r.title || "Unknown",
      }))
  }, [ratings, isGuest])

  const hasEnoughData = seeds.length > 0
  const needsFallback = seeds.length < 3

  // Fetch recommendations for each seed in parallel
  const recommendationQueries = useQueries({
    queries: seeds.map((seed) => ({
      queryKey: ["for-you", "recommendations", seed.mediaType, seed.id],
      queryFn: () => fetchRecommendations(seed.id, seed.mediaType),
      enabled: !isGuest,
      staleTime: 1000 * 60 * 10, // 10 minutes
    })),
  })

  // Build sections from seeds and their recommendations
  // No filtering applied to recommendation results (matches mobile behavior)
  const sections = useMemo((): RecommendationSection[] => {
    return seeds
      .map((seed, i) => ({
        seed,
        recommendations: (recommendationQueries[i]?.data || []) as TMDBMedia[],
        isLoading: recommendationQueries[i]?.isLoading ?? false,
      }))
      .filter((s) => s.recommendations.length > 0 || s.isLoading)
  }, [seeds, recommendationQueries])

  // Fetch hidden gems (high-rated, low-popularity movies)
  const { data: hiddenGemsData, isLoading: isLoadingHiddenGems } = useQuery({
    queryKey: ["for-you", "hidden-gems"],
    queryFn: fetchDiscoverHiddenGems,
    enabled: !isGuest && hasEnoughData,
    staleTime: 1000 * 60 * 30, // 30 minutes
  })

  // Fetch trending as fallback when user doesn't have enough data
  const { data: trendingData, isLoading: isLoadingTrending } = useQuery({
    queryKey: ["for-you", "trending-week"],
    queryFn: fetchTrendingWeek,
    enabled: !isGuest && needsFallback,
    staleTime: 1000 * 60 * 60, // 1 hour
  })

  const isLoading =
    isLoadingRatings ||
    recommendationQueries.some((q) => q.isLoading) ||
    isLoadingHiddenGems ||
    isLoadingTrending

  return {
    /** Personalized recommendation sections */
    sections,
    /** Hidden gems (high-quality, low-popularity content) */
    hiddenGems: hiddenGemsData || [],
    /** Trending content for fallback */
    trendingMovies: trendingData || [],
    /** Overall loading state */
    isLoading,
    /** Whether auth is still loading */
    isAuthLoading,
    /** Whether user has rated enough content */
    hasEnoughData,
    /** Whether trending fallback should be shown */
    needsFallback,
    /** Whether user is a guest */
    isGuest,
  }
}
