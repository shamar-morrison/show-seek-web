"use client"

import { useAuth } from "@/context/auth-context"
import { addToList } from "@/lib/firebase/lists"
import {
  addWatch,
  clearWatches,
  getWatchCount,
  subscribeToWatches,
  WatchInstance,
} from "@/lib/firebase/watched-movies"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

interface UseWatchedMoviesReturn {
  /** All watch instances for this movie, sorted by most recent first */
  instances: WatchInstance[]
  /** Total number of times watched */
  count: number
  /** Most recent watch date, or null if never watched */
  lastWatchedAt: Date | null
  /** Whether data is still loading */
  isLoading: boolean
  /** Add a new watch instance */
  addWatchInstance: (
    watchedAt: Date,
    movieData: {
      title: string
      posterPath: string | null
      voteAverage?: number
      releaseDate?: string
      genreIds?: number[]
    },
  ) => Promise<void>
  /** Clear all watch history for this movie */
  clearAllWatches: () => Promise<void>
}

/**
 * Hook for managing watch history for a specific movie
 * Provides real-time updates via Firestore subscription
 */
export function useWatchedMovies(movieId: number): UseWatchedMoviesReturn {
  const { user } = useAuth()
  const [instances, setInstances] = useState<WatchInstance[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Subscribe to watch instances
  useEffect(() => {
    if (!user || user.isAnonymous) {
      setInstances([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)

    const unsubscribe = subscribeToWatches(
      user.uid,
      movieId,
      (watchInstances) => {
        setInstances(watchInstances)
        setIsLoading(false)
      },
      (error) => {
        console.error("Error loading watch history:", error)
        setIsLoading(false)
      },
    )

    return unsubscribe
  }, [user, movieId])

  // Add a new watch instance
  const addWatchInstance = useCallback(
    async (
      watchedAt: Date,
      movieData: {
        title: string
        posterPath: string | null
        voteAverage?: number
        releaseDate?: string
        genreIds?: number[]
      },
    ): Promise<void> => {
      if (!user || user.isAnonymous) {
        throw new Error("User must be authenticated to mark as watched")
      }

      // Check if this is the first watch (for auto-add to already-watched)
      const currentCount = await getWatchCount(user.uid, movieId)
      const isFirstWatch = currentCount === 0

      // Add the watch instance
      await addWatch(user.uid, movieId, watchedAt)

      // Auto-add to "Already Watched" list on first watch
      if (isFirstWatch) {
        try {
          await addToList(user.uid, "already-watched", {
            id: movieId,
            title: movieData.title,
            poster_path: movieData.posterPath,
            media_type: "movie",
            vote_average: movieData.voteAverage,
            release_date: movieData.releaseDate,
            genre_ids: movieData.genreIds,
          })
        } catch (listError) {
          console.error(
            "Failed to auto-add to Already Watched list:",
            listError,
          )
        }
      }

      toast.success("Marked as watched")
    },
    [user, movieId],
  )

  // Clear all watch history
  const clearAllWatches = useCallback(async (): Promise<void> => {
    if (!user || user.isAnonymous) {
      throw new Error("User must be authenticated to clear watch history")
    }

    await clearWatches(user.uid, movieId)
    toast.success("Watch history cleared")
  }, [user, movieId])

  return {
    instances,
    count: instances.length,
    lastWatchedAt: instances.length > 0 ? instances[0].watchedAt : null,
    isLoading,
    addWatchInstance,
    clearAllWatches,
  }
}
