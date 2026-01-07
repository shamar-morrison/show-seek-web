"use client"

import { useAuth } from "@/context/auth-context"
import {
  deleteRating,
  setRating,
  subscribeToRatings,
} from "@/lib/firebase/ratings"
import type { Rating } from "@/types/rating"
import { useCallback, useEffect, useMemo, useState } from "react"

/** Sort options for ratings */
export type RatingSortOption = "ratedAt" | "rating" | "alphabetical"

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
 * Sort episode ratings by the specified option
 */
function sortEpisodeRatings(
  ratings: Rating[],
  sortBy: RatingSortOption,
): Rating[] {
  return [...ratings].sort((a, b) => {
    switch (sortBy) {
      case "ratedAt":
        return b.ratedAt - a.ratedAt // Most recent first
      case "rating":
        return b.rating - a.rating // Highest rating first
      case "alphabetical":
        // Sort by TV show name, then by season, then by episode
        const showCompare = (a.tvShowName || "").localeCompare(
          b.tvShowName || "",
        )
        if (showCompare !== 0) return showCompare
        const seasonCompare = (a.seasonNumber || 0) - (b.seasonNumber || 0)
        if (seasonCompare !== 0) return seasonCompare
        return (a.episodeNumber || 0) - (b.episodeNumber || 0)
      default:
        return 0
    }
  })
}

/**
 * Hook for movie ratings
 * Uses Firebase data directly - no TMDB enrichment needed
 */
export function useMovieRatings(
  sortBy: RatingSortOption = "ratedAt",
  enabled: boolean = true,
) {
  const { ratings, loading: ratingsLoading } = useRatings()

  // Filter and sort movie ratings
  const movieRatings = useMemo(() => {
    const filtered = Array.from(ratings.values()).filter(
      (r) => r.mediaType === "movie",
    )
    return enabled ? sortRatings(filtered, sortBy) : filtered
  }, [ratings, sortBy, enabled])

  return {
    ratings: movieRatings,
    loading: ratingsLoading,
    count: movieRatings.length,
  }
}

/**
 * Hook for TV show ratings
 * Uses Firebase data directly - no TMDB enrichment needed
 */
export function useTVRatings(
  sortBy: RatingSortOption = "ratedAt",
  enabled: boolean = true,
) {
  const { ratings, loading: ratingsLoading } = useRatings()

  // Filter and sort TV ratings
  const tvRatings = useMemo(() => {
    const filtered = Array.from(ratings.values()).filter(
      (r) => r.mediaType === "tv",
    )
    return enabled ? sortRatings(filtered, sortBy) : filtered
  }, [ratings, sortBy, enabled])

  return {
    ratings: tvRatings,
    loading: ratingsLoading,
    count: tvRatings.length,
  }
}

/**
 * Hook for episode ratings
 * Uses Firebase data directly - no TMDB enrichment needed
 */
export function useEpisodeRatings(
  sortBy: RatingSortOption = "ratedAt",
  enabled: boolean = true,
) {
  const { ratings, loading: ratingsLoading } = useRatings()

  // Filter and sort episode ratings
  const episodeRatings = useMemo(() => {
    const filtered = Array.from(ratings.values()).filter(
      (r) => r.mediaType === "episode",
    )
    return enabled ? sortEpisodeRatings(filtered, sortBy) : filtered
  }, [ratings, sortBy, enabled])

  return {
    ratings: episodeRatings,
    loading: ratingsLoading,
    count: episodeRatings.length,
  }
}
