"use client"

import { useAuth } from "@/context/auth-context"
import {
  deleteRating,
  setRating,
  subscribeToRatings,
} from "@/lib/firebase/ratings"
import type { Rating } from "@/types/rating"
import { useCallback, useEffect, useState } from "react"

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
      mediaTitle: string,
      posterPath: string | null,
    ): Promise<void> => {
      if (!user || user.isAnonymous) {
        throw new Error("User must be authenticated to rate")
      }

      await setRating(user.uid, {
        userId: user.uid,
        mediaType,
        mediaId,
        rating,
        mediaTitle,
        posterPath,
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
