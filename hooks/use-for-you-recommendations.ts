"use client"

import {
  fetchDiscoverHiddenGems,
  fetchFullTVDetails,
  fetchMovieDetails,
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

/** Preliminary seed with nullable title (null = needs TMDB fetch) */
interface PreliminarySeed {
  id: number
  mediaType: "movie" | "tv"
  title: string | null
}

/** Seed item with resolved title */
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

  // Step 1: Extract preliminary seeds (title may be null if missing from rating)
  const preliminarySeeds = useMemo((): PreliminarySeed[] => {
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
        title: r.title || null, // null indicates title needs fetching
      }))
  }, [ratings, isGuest])

  // Step 2: Fetch missing titles from TMDB
  const seedsNeedingTitles = preliminarySeeds.filter((s) => s.title === null)

  const titleQueries = useQueries({
    queries: seedsNeedingTitles.map((seed) => ({
      queryKey: ["seed-title", seed.mediaType, seed.id],
      queryFn: async (): Promise<{ id: number; title: string } | null> => {
        if (seed.mediaType === "movie") {
          const movie = await fetchMovieDetails(seed.id)
          return movie ? { id: seed.id, title: movie.title } : null
        } else {
          const show = await fetchFullTVDetails(seed.id)
          return show ? { id: seed.id, title: show.name } : null
        }
      },
      enabled: !isGuest && seed.title === null,
      staleTime: Infinity, // Titles don't change
    })),
  })

  const isLoadingTitles = titleQueries.some((q) => q.isLoading)

  // Step 3: Build title lookup map from fetched results
  const fetchedTitlesMap = useMemo(() => {
    const map = new Map<number, string>()
    titleQueries.forEach((query) => {
      if (query.data) {
        map.set(query.data.id, query.data.title)
      }
    })
    return map
  }, [titleQueries])

  // Step 4: Resolve final seeds with proper titles (filter out unresolved)
  const seeds = useMemo((): Seed[] => {
    return preliminarySeeds
      .map((seed) => ({
        id: seed.id,
        mediaType: seed.mediaType,
        // Priority: stored title > fetched title > null (will be filtered)
        title: seed.title || fetchedTitlesMap.get(seed.id) || null,
      }))
      .filter((s): s is Seed => s.title !== null) // Only include seeds with resolved titles
  }, [preliminarySeeds, fetchedTitlesMap])

  // Detect empty state (no qualifying high-rated items)
  const hasNoQualifyingRatings = preliminarySeeds.length === 0
  const needsFallback =
    preliminarySeeds.length > 0 && preliminarySeeds.length < 3

  // Fetch recommendations for each seed in parallel
  const recommendationQueries = useQueries({
    queries: seeds.map((seed) => ({
      queryKey: ["for-you", "recommendations", seed.mediaType, seed.id],
      queryFn: () => fetchRecommendations(seed.id, seed.mediaType),
      enabled: !isGuest && seed.title !== null,
      staleTime: 1000 * 60 * 10, // 10 minutes
    })),
  })

  // Build sections from seeds and their recommendations
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
    enabled: !isGuest && !hasNoQualifyingRatings,
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
    isLoadingTitles ||
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
    /** Whether user has no qualifying high-rated items */
    hasNoQualifyingRatings,
    /** Whether trending fallback should be shown */
    needsFallback,
    /** Whether user is a guest */
    isGuest,
  }
}
