"use client"

import { useAuth } from "@/context/auth-context"
import { useListMutations } from "@/hooks/use-list-mutations"
import {
  addWatch,
  clearWatches,
  fetchWatches,
  getWatchCount,
  WatchInstance,
} from "@/lib/firebase/watched-movies"
import { queryCacheProfiles } from "@/lib/react-query/query-options"
import { queryKeys } from "@/lib/react-query/query-keys"
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { useCallback } from "react"
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
    },
    autoAddToAlreadyWatched?: boolean,
  ) => Promise<void>
  clearAllWatches: () => Promise<void>
}

/**
 * Hook for managing watch history for a specific movie with React Query caching.
 */
export function useWatchedMovies(
  movieId: number,
  options: { enabled?: boolean } = { enabled: true },
): UseWatchedMoviesReturn {
  const { user, loading: authLoading } = useAuth()
  const { addToList } = useListMutations()
  const queryClient = useQueryClient()

  const userId = user && !user.isAnonymous ? user.uid : null
  const enabled = !!options.enabled && !!userId
  const watchesQueryKey = userId
    ? queryKeys.firestore.watchedMovies(userId, movieId)
    : null

  const { data: instances = [], isLoading } = useQuery({
    ...queryCacheProfiles.status,
    queryKey: watchesQueryKey ?? ["firestore", "watched-movies", "guest", movieId],
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
      }
      autoAddToAlreadyWatched: boolean
    }) => {
      if (!userId) {
        throw new Error("User must be authenticated to mark as watched")
      }

      const isFirstWatch =
        variables.isFirstWatch ??
        ((await getWatchCount(userId, movieId)) === 0)

      await addWatch(userId, movieId, variables.watchedAt)

      if (isFirstWatch && variables.autoAddToAlreadyWatched) {
        try {
          await addToList("already-watched", {
            id: movieId,
            title: variables.movieData.title,
            poster_path: variables.movieData.posterPath,
            media_type: "movie",
            vote_average: variables.movieData.voteAverage,
            release_date: variables.movieData.releaseDate,
            genre_ids: variables.movieData.genreIds,
          })
        } catch (listError) {
          console.error("Failed to auto-add to Already Watched list:", listError)
        }
      }
    },
    onMutate: async (variables) => {
      if (!watchesQueryKey) {
        return { previousWatches: undefined as WatchInstance[] | undefined }
      }

      await queryClient.cancelQueries({ queryKey: watchesQueryKey })
      const previousWatches = queryClient.getQueryData<WatchInstance[]>(
        watchesQueryKey,
      )

      const optimisticWatch: WatchInstance = {
        id: `optimistic-${Date.now()}`,
        movieId,
        watchedAt: variables.watchedAt,
      }

      const nextWatches = [...(previousWatches ?? []), optimisticWatch].sort(
        (a, b) => b.watchedAt.getTime() - a.watchedAt.getTime(),
      )

      queryClient.setQueryData(watchesQueryKey, nextWatches)
      return { previousWatches }
    },
    onError: (_error, _variables, context) => {
      if (!watchesQueryKey) return
      if (context?.previousWatches) {
        queryClient.setQueryData(watchesQueryKey, context.previousWatches)
      }
    },
    onSettled: () => {
      if (!watchesQueryKey) return
      queryClient.invalidateQueries({ queryKey: watchesQueryKey })
    },
  })

  const clearWatchesMutation = useMutation({
    mutationFn: async () => {
      if (!userId) {
        throw new Error("User must be authenticated to clear watch history")
      }

      await clearWatches(userId, movieId)
    },
    onMutate: async () => {
      if (!watchesQueryKey) {
        return { previousWatches: undefined as WatchInstance[] | undefined }
      }

      await queryClient.cancelQueries({ queryKey: watchesQueryKey })
      const previousWatches = queryClient.getQueryData<WatchInstance[]>(
        watchesQueryKey,
      )

      queryClient.setQueryData(watchesQueryKey, [])
      return { previousWatches }
    },
    onError: (_error, _variables, context) => {
      if (!watchesQueryKey) return
      if (context?.previousWatches) {
        queryClient.setQueryData(watchesQueryKey, context.previousWatches)
      }
    },
    onSettled: () => {
      if (!watchesQueryKey) return
      queryClient.invalidateQueries({ queryKey: watchesQueryKey })
    },
  })

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
      autoAddToAlreadyWatched: boolean = false,
    ): Promise<void> => {
      await addWatchMutation.mutateAsync({
        watchedAt,
        isFirstWatch: instances.length === 0,
        movieData,
        autoAddToAlreadyWatched,
      })
      toast.success("Marked as watched")
    },
    [addWatchMutation, instances.length],
  )

  const clearAllWatches = useCallback(async (): Promise<void> => {
    await clearWatchesMutation.mutateAsync()
    toast.success("Watch history cleared")
  }, [clearWatchesMutation])

  return {
    instances,
    count: instances.length,
    lastWatchedAt: instances.length > 0 ? instances[0].watchedAt : null,
    isLoading: authLoading || (enabled && isLoading),
    addWatchInstance,
    clearAllWatches,
  }
}
