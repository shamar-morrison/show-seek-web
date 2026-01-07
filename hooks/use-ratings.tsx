"use client"

import { fetchFullTVDetails, fetchMovieDetails } from "@/app/actions"
import { useAuth } from "@/context/auth-context"
import {
  deleteRating,
  setRating,
  subscribeToRatings,
} from "@/lib/firebase/ratings"
import type { Rating } from "@/types/rating"
import type { TMDBMovieDetails, TMDBTVDetails } from "@/types/tmdb"
import { useQueries } from "@tanstack/react-query"
import { useCallback, useEffect, useMemo, useState } from "react"

/** Sort options for ratings */
export type RatingSortOption = "ratedAt" | "rating" | "alphabetical"

/** Enriched rating with TMDB data */
export interface EnrichedRating<T = TMDBMovieDetails | TMDBTVDetails> {
  rating: Rating
  media: T | null
}

/** Query keys for ratings TMDB enrichment */
export const ratingsQueryKeys = {
  movieDetails: (mediaId: number) => ["ratings", "movie", mediaId] as const,
  tvDetails: (mediaId: number) => ["ratings", "tv", mediaId] as const,
}

/**
 * Hook for managing user ratings with real-time updates
 */
export function useRatings() {
  const { user, loading: authLoading } = useAuth()
  const [ratings, setRatings] = useState<Map<string, Rating>>(new Map())
  const [loading, setLoading] = useState(true)

  // Subscribe to real-time rating updates
  useEffect(() => {
    if (authLoading) return
    if (!user || user.isAnonymous) {
      setRatings(new Map())
      setLoading(false)
      return
    }

    setLoading(true)
    const unsubscribe = subscribeToRatings(
      user.uid,
      (ratingsMap) => {
        setRatings(ratingsMap)
        setLoading(false)
      },
      (error) => {
        console.error("Error loading ratings:", error)
        setLoading(false)
      },
    )

    return () => unsubscribe()
  }, [user, authLoading])

  /**
   * Get a rating for a specific media item
   */
  const getRating = useCallback(
    (mediaType: "movie" | "tv", mediaId: number): Rating | null => {
      const key = `${mediaType}-${mediaId}`
      return ratings.get(key) || null
    },
    [ratings],
  )

  /**
   * Save or update a rating for a media item
   */
  const saveRating = useCallback(
    async (
      mediaType: "movie" | "tv",
      mediaId: number,
      rating: number,
      title: string,
      posterPath: string | null,
      releaseDate: string | null = null,
    ): Promise<void> => {
      if (!user || user.isAnonymous) {
        throw new Error("User must be authenticated to rate")
      }

      await setRating(user.uid, {
        userId: user.uid,
        id: `${mediaType}-${mediaId}`,
        mediaType,
        mediaId: mediaId.toString(),
        rating,
        title,
        posterPath,
        releaseDate,
      })
    },
    [user],
  )

  /**
   * Remove a rating for a media item
   */
  const removeRating = useCallback(
    async (mediaType: "movie" | "tv", mediaId: number): Promise<void> => {
      if (!user || user.isAnonymous) {
        throw new Error("User must be authenticated to remove rating")
      }

      await deleteRating(user.uid, mediaType, mediaId)
    },
    [user],
  )

  return {
    ratings,
    loading,
    getRating,
    saveRating,
    removeRating,
  }
}

/**
 * Sort ratings by the specified option
 */
function sortRatings(ratings: Rating[], sortBy: RatingSortOption): Rating[] {
  return [...ratings].sort((a, b) => {
    switch (sortBy) {
      case "ratedAt":
        return b.ratedAt - a.ratedAt // Most recent first
      case "rating":
        return b.rating - a.rating // Highest rating first
      case "alphabetical":
        return a.title.localeCompare(b.title)
      default:
        return 0
    }
  })
}

/**
 * Hook for movie ratings with TMDB enrichment via React Query
 * Uses React Query's built-in caching - data persists across tab switches
 */
export function useMovieRatings(
  sortBy: RatingSortOption = "ratedAt",
  enabled: boolean = true,
) {
  const { ratings, loading: ratingsLoading } = useRatings()

  // Filter movie ratings
  const movieRatings = useMemo(() => {
    return Array.from(ratings.values()).filter((r) => r.mediaType === "movie")
  }, [ratings])

  // Use React Query's useQueries for parallel fetching with automatic caching
  const queries = useQueries({
    queries: movieRatings.map((rating) => ({
      queryKey: ratingsQueryKeys.movieDetails(parseInt(rating.mediaId)),
      queryFn: async (): Promise<TMDBMovieDetails | null> => {
        return await fetchMovieDetails(parseInt(rating.mediaId)).catch(
          () => null,
        )
      },
      // Only fetch when enabled
      enabled,
      // Keep data fresh for 5 minutes, but show stale data immediately
      staleTime: 5 * 60 * 1000,
      // Cache for 30 minutes
      gcTime: 30 * 60 * 1000,
    })),
  })

  // Combine ratings with TMDB data
  const enrichedRatings = useMemo(() => {
    const results: EnrichedRating<TMDBMovieDetails>[] = movieRatings.map(
      (rating, index) => ({
        rating,
        media: queries[index]?.data ?? null,
      }),
    )
    // Sort after enrichment
    const sortedRatings = sortRatings(
      results.map((r) => r.rating),
      sortBy,
    )
    return sortedRatings.map((rating) => {
      const enriched = results.find((r) => r.rating.id === rating.id)
      return enriched ?? { rating, media: null }
    })
  }, [movieRatings, queries, sortBy])

  // Check if any queries are still loading (for initial load only)
  const isEnriching = queries.some((q) => q.isLoading)
  const hasData = queries.some((q) => q.data !== undefined)

  return {
    ratings: enrichedRatings,
    // Only show loading skeleton on initial load, not when switching tabs
    loading: ratingsLoading || (enabled && isEnriching && !hasData),
    count: movieRatings.length,
  }
}

/**
 * Hook for TV show ratings with TMDB enrichment via React Query
 * Uses React Query's built-in caching - data persists across tab switches
 */
export function useTVRatings(
  sortBy: RatingSortOption = "ratedAt",
  enabled: boolean = true,
) {
  const { ratings, loading: ratingsLoading } = useRatings()

  // Filter TV ratings
  const tvRatings = useMemo(() => {
    return Array.from(ratings.values()).filter((r) => r.mediaType === "tv")
  }, [ratings])

  // Use React Query's useQueries for parallel fetching with automatic caching
  const queries = useQueries({
    queries: tvRatings.map((rating) => ({
      queryKey: ratingsQueryKeys.tvDetails(parseInt(rating.mediaId)),
      queryFn: async (): Promise<TMDBTVDetails | null> => {
        return await fetchFullTVDetails(parseInt(rating.mediaId)).catch(
          () => null,
        )
      },
      // Only fetch when enabled
      enabled,
      // Keep data fresh for 5 minutes, but show stale data immediately
      staleTime: 5 * 60 * 1000,
      // Cache for 30 minutes
      gcTime: 30 * 60 * 1000,
    })),
  })

  // Combine ratings with TMDB data
  const enrichedRatings = useMemo(() => {
    const results: EnrichedRating<TMDBTVDetails>[] = tvRatings.map(
      (rating, index) => ({
        rating,
        media: queries[index]?.data ?? null,
      }),
    )
    // Sort after enrichment
    const sortedRatings = sortRatings(
      results.map((r) => r.rating),
      sortBy,
    )
    return sortedRatings.map((rating) => {
      const enriched = results.find((r) => r.rating.id === rating.id)
      return enriched ?? { rating, media: null }
    })
  }, [tvRatings, queries, sortBy])

  // Check if any queries are still loading (for initial load only)
  const isEnriching = queries.some((q) => q.isLoading)
  const hasData = queries.some((q) => q.data !== undefined)

  return {
    ratings: enrichedRatings,
    // Only show loading skeleton on initial load, not when switching tabs
    loading: ratingsLoading || (enabled && isEnriching && !hasData),
    count: tvRatings.length,
  }
}
