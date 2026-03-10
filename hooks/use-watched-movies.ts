"use client"

import { fetchMovieDetails } from "@/app/actions"
import { useAuth } from "@/context/auth-context"
import { useListMutations } from "@/hooks/use-list-mutations"
import {
  addWatchedMovieToTrackedCollection,
  fetchAllTrackedCollections,
  removeWatchedMovieFromTrackedCollection,
} from "@/lib/firebase/collection-tracking"
import {
  addWatch,
  clearWatches,
  fetchWatches,
  getWatchCount,
  WatchInstance,
} from "@/lib/firebase/watched-movies"
import { applyWatchedMovieListAutomation } from "@/lib/movie-list-automation"
import { queryCacheProfiles } from "@/lib/react-query/query-options"
import {
  queryKeys,
  UNAUTHENTICATED_USER_ID,
} from "@/lib/react-query/query-keys"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useEffect, useRef } from "react"
import { toast } from "sonner"

interface UseWatchedMoviesReturn {
  instances: WatchInstance[]
  count: number
  lastWatchedAt: Date | null
  isLoading: boolean
  addWatchInstance: (
    watchedAt: Date,
    movieData: {
      title: string
      posterPath: string | null
      voteAverage?: number
      releaseDate?: string
      genreIds?: number[]
      collectionId?: number | null
    },
    autoAddToAlreadyWatched?: boolean,
    autoRemoveFromShouldWatch?: boolean,
  ) => Promise<void>
  clearAllWatches: () => Promise<void>
}

interface WatchMutationContext {
  previousWatches: WatchInstance[] | undefined
}

async function resolveCollectionId(movieId: number, collectionId?: number | null) {
  if (typeof collectionId === "number") {
    return collectionId
  }

  try {
    const movieDetails = await fetchMovieDetails(movieId)
    return movieDetails?.belongs_to_collection?.id ?? null
  } catch (error) {
    console.warn(
      `[useWatchedMovies] Failed to resolve collection for movie ${movieId}:`,
      error,
    )
    return null
  }
}

async function syncCollectionTrackingAfterWatch(
  userId: string,
  movieId: number,
  collectionId?: number | null,
) {
  try {
    const resolvedCollectionId = await resolveCollectionId(movieId, collectionId)

    if (!resolvedCollectionId) {
      return
    }

    await addWatchedMovieToTrackedCollection(userId, resolvedCollectionId, movieId)
  } catch (error) {
    console.warn(
      `[useWatchedMovies] Failed to sync collection tracking after watch for movie ${movieId}:`,
      error,
    )
  }
}

async function syncCollectionTrackingAfterUnwatch(userId: string, movieId: number) {
  try {
    const trackedCollections = await fetchAllTrackedCollections(userId)
    const affectedCollections = trackedCollections.filter((trackedCollection) =>
      trackedCollection.watchedMovieIds.includes(movieId),
    )

    if (affectedCollections.length === 0) {
      return
    }

    const results = await Promise.allSettled(
      affectedCollections.map((trackedCollection) =>
        removeWatchedMovieFromTrackedCollection(
          userId,
          trackedCollection.collectionId,
          movieId,
        ),
      ),
    )

    results.forEach((result, index) => {
      if (result.status === "rejected") {
        console.warn(
          `[useWatchedMovies] Failed to remove movie ${movieId} from tracked collection ${affectedCollections[index].collectionId}:`,
          result.reason,
        )
      }
    })
  } catch (error) {
    console.warn(
      `[useWatchedMovies] Failed to sync collection tracking after unwatch for movie ${movieId}:`,
      error,
    )
  }
}

/**
 * Hook for managing watch history for a specific movie with React Query caching.
 */
export function useWatchedMovies(
  movieId: number,
  options: { enabled?: boolean } = { enabled: true },
): UseWatchedMoviesReturn {
  const { user, loading: authLoading } = useAuth()
  const { addToList, removeFromList } = useListMutations()
  const queryClient = useQueryClient()

  const userId = user && !user.isAnonymous ? user.uid : null
  const enabled = !!options.enabled && !!userId
  const watchesReadQueryKey = queryKeys.firestore.watchedMovies(
    userId ?? UNAUTHENTICATED_USER_ID,
    movieId,
  )
  const watchesQueryKey = userId
    ? queryKeys.firestore.watchedMovies(userId, movieId)
    : null

  const { data: instances = [], isLoading } = useQuery({
    ...queryCacheProfiles.status,
    queryKey: watchesReadQueryKey,
    queryFn: async () => {
      if (!userId) return []
      return fetchWatches(userId, movieId)
    },
    enabled,
  })

  const addWatchMutation = useMutation({
    mutationFn: async (variables: {
      watchedAt: Date
      isFirstWatch?: boolean
      movieData: {
        title: string
        posterPath: string | null
        voteAverage?: number
        releaseDate?: string
        genreIds?: number[]
        collectionId?: number | null
      }
      autoAddToAlreadyWatched: boolean
      autoRemoveFromShouldWatch: boolean
    }) => {
      if (!userId) {
        throw new Error("User must be authenticated to mark as watched")
      }

      const isFirstWatch =
        variables.isFirstWatch ?? (await getWatchCount(userId, movieId)) === 0

      await addWatch(userId, movieId, variables.watchedAt)

      await syncCollectionTrackingAfterWatch(
        userId,
        movieId,
        variables.movieData.collectionId,
      )

      await applyWatchedMovieListAutomation({
        movie: {
          movieId,
          title: variables.movieData.title,
          posterPath: variables.movieData.posterPath,
          voteAverage: variables.movieData.voteAverage,
          releaseDate: variables.movieData.releaseDate,
          genreIds: variables.movieData.genreIds,
        },
        isFirstWatch,
        autoAddToAlreadyWatched: variables.autoAddToAlreadyWatched,
        autoRemoveFromShouldWatch: variables.autoRemoveFromShouldWatch,
        addToList,
        removeFromList,
      })
    },
    onMutate: async (variables) => {
      if (!watchesQueryKey) {
        return { previousWatches: undefined } satisfies WatchMutationContext
      }

      await queryClient.cancelQueries({ queryKey: watchesQueryKey })
      const previousWatches =
        queryClient.getQueryData<WatchInstance[]>(watchesQueryKey)

      const optimisticWatch: WatchInstance = {
        id: `optimistic-${Date.now()}`,
        movieId,
        watchedAt: variables.watchedAt,
      }

      const nextWatches = [...(previousWatches ?? []), optimisticWatch].sort(
        (a, b) => b.watchedAt.getTime() - a.watchedAt.getTime(),
      )

      queryClient.setQueryData(watchesQueryKey, nextWatches)
      return { previousWatches } satisfies WatchMutationContext
    },
    onError: (_error, _variables, context) => {
      if (!watchesQueryKey || !context) return
      queryClient.setQueryData(watchesQueryKey, context.previousWatches)
    },
    onSettled: () => {
      if (!watchesQueryKey) return
      queryClient.invalidateQueries({ queryKey: watchesQueryKey })
      queryClient.invalidateQueries({
        queryKey: queryKeys.firestore.collectionTrackingRoot,
      })
    },
  })

  const addWatchMutationRef = useRef(addWatchMutation.mutateAsync)

  useEffect(() => {
    addWatchMutationRef.current = addWatchMutation.mutateAsync
  }, [addWatchMutation.mutateAsync])

  const clearWatchesMutation = useMutation({
    mutationFn: async () => {
      if (!userId) {
        throw new Error("User must be authenticated to clear watch history")
      }

      await clearWatches(userId, movieId)
      await syncCollectionTrackingAfterUnwatch(userId, movieId)
    },
    onMutate: async () => {
      if (!watchesQueryKey) {
        return { previousWatches: undefined } satisfies WatchMutationContext
      }

      await queryClient.cancelQueries({ queryKey: watchesQueryKey })
      const previousWatches =
        queryClient.getQueryData<WatchInstance[]>(watchesQueryKey)

      queryClient.setQueryData(watchesQueryKey, [])
      return { previousWatches } satisfies WatchMutationContext
    },
    onError: (_error, _variables, context) => {
      if (!watchesQueryKey || !context) return
      queryClient.setQueryData(watchesQueryKey, context.previousWatches)
    },
    onSettled: () => {
      if (!watchesQueryKey) return
      queryClient.invalidateQueries({ queryKey: watchesQueryKey })
      queryClient.invalidateQueries({
        queryKey: queryKeys.firestore.collectionTrackingRoot,
      })
    },
  })

  const clearWatchesMutationRef = useRef(clearWatchesMutation.mutateAsync)

  useEffect(() => {
    clearWatchesMutationRef.current = clearWatchesMutation.mutateAsync
  }, [clearWatchesMutation.mutateAsync])

  const addWatchInstance = useCallback(
    async (
      watchedAt: Date,
      movieData: {
        title: string
        posterPath: string | null
        voteAverage?: number
        releaseDate?: string
        genreIds?: number[]
        collectionId?: number | null
      },
      autoAddToAlreadyWatched: boolean = false,
      autoRemoveFromShouldWatch: boolean = false,
    ): Promise<void> => {
      try {
        await addWatchMutationRef.current({
          watchedAt,
          isFirstWatch: instances.length === 0,
          movieData,
          autoAddToAlreadyWatched,
          autoRemoveFromShouldWatch,
        })
        toast.success("Marked as watched")
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error"
        toast.error(`Failed to mark as watched: ${errorMessage}`)
      }
    },
    [instances.length],
  )

  const clearAllWatches = useCallback(async (): Promise<void> => {
    try {
      await clearWatchesMutationRef.current()
      toast.success("Watch history cleared")
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error"
      toast.error(`Failed to clear watch history: ${errorMessage}`)
    }
  }, [])

  return {
    instances,
    count: instances.length,
    lastWatchedAt: instances.length > 0 ? instances[0].watchedAt : null,
    isLoading: authLoading || (enabled && isLoading),
    addWatchInstance,
    clearAllWatches,
  }
}
