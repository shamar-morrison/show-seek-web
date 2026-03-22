"use client"

import { fetchMovieDetails } from "@/app/actions"
import { useAuth } from "@/context/auth-context"
import { useListMutations } from "@/hooks/use-list-mutations"
import { showActionableSuccessToast } from "@/lib/actionable-toast"
import {
  addWatchedMovieToTrackedCollection,
  fetchAllTrackedCollections,
  removeWatchedMovieFromTrackedCollection,
} from "@/lib/firebase/collection-tracking"
import {
  addWatch,
  clearWatches,
  deleteWatch,
  fetchWatches,
  getWatchCount,
  updateWatch,
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
  deleteWatchInstance: (watchId: string) => Promise<void>
  updateWatchInstance: (watchId: string, watchedAt: Date) => Promise<void>
}

interface WatchMutationContext {
  previousWatches: WatchInstance[] | undefined
}

async function resolveCollectionId(
  movieId: number,
  collectionId?: number | null,
) {
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
): Promise<boolean> {
  try {
    const resolvedCollectionId = await resolveCollectionId(
      movieId,
      collectionId,
    )

    if (!resolvedCollectionId) {
      return false
    }

    await addWatchedMovieToTrackedCollection(
      userId,
      resolvedCollectionId,
      movieId,
    )
    return true
  } catch (error) {
    console.warn(
      `[useWatchedMovies] Failed to sync collection tracking after watch for movie ${movieId}:`,
      error,
    )
    return false
  }
}

async function syncCollectionTrackingAfterUnwatch(
  userId: string,
  movieId: number,
): Promise<number[]> {
  try {
    const trackedCollections = await fetchAllTrackedCollections(userId)
    const affectedCollections = trackedCollections.filter((trackedCollection) =>
      trackedCollection.watchedMovieIds.includes(movieId),
    )

    if (affectedCollections.length === 0) {
      return []
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
    const removedCollectionIds: number[] = []

    results.forEach((result, index) => {
      if (result.status === "rejected") {
        console.warn(
          `[useWatchedMovies] Failed to remove movie ${movieId} from tracked collection ${affectedCollections[index].collectionId}:`,
          result.reason,
        )
        return
      }

      removedCollectionIds.push(affectedCollections[index].collectionId)
    })

    return removedCollectionIds
  } catch (error) {
    console.warn(
      `[useWatchedMovies] Failed to sync collection tracking after unwatch for movie ${movieId}:`,
      error,
    )
    return []
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

      const watchId = await addWatch(userId, movieId, variables.watchedAt)

      if (typeof variables.movieData.collectionId === "number") {
        await syncCollectionTrackingAfterWatch(
          userId,
          movieId,
          variables.movieData.collectionId,
        )
      } else {
        void syncCollectionTrackingAfterWatch(
          userId,
          movieId,
          variables.movieData.collectionId,
        ).then((didSync) => {
          if (!didSync) {
            return
          }

          void queryClient.invalidateQueries({
            queryKey: queryKeys.firestore.collectionTrackingRoot,
          })
        })
      }

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

      return { watchId }
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
      const removedCollectionIds = await syncCollectionTrackingAfterUnwatch(
        userId,
        movieId,
      )

      return { removedCollectionIds }
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

  const deleteWatchMutation = useMutation({
    mutationFn: async ({ watchId }: { watchId: string }) => {
      if (!userId) {
        throw new Error("User must be authenticated to delete watch history")
      }

      await deleteWatch(userId, movieId, watchId)
    },
    onMutate: async ({ watchId }) => {
      if (!watchesQueryKey) {
        return { previousWatches: undefined } satisfies WatchMutationContext
      }

      await queryClient.cancelQueries({ queryKey: watchesQueryKey })
      const previousWatches =
        queryClient.getQueryData<WatchInstance[]>(watchesQueryKey)

      queryClient.setQueryData<WatchInstance[]>(
        watchesQueryKey,
        (currentWatches) =>
          (currentWatches ?? []).filter((watch) => watch.id !== watchId),
      )

      return { previousWatches } satisfies WatchMutationContext
    },
    onError: (_error, _variables, context) => {
      if (!watchesQueryKey || !context) return
      queryClient.setQueryData(watchesQueryKey, context.previousWatches)
    },
    onSettled: () => {
      if (!watchesQueryKey) return
      queryClient.invalidateQueries({ queryKey: watchesQueryKey })
    },
  })

  const deleteWatchMutationRef = useRef(deleteWatchMutation.mutateAsync)

  useEffect(() => {
    deleteWatchMutationRef.current = deleteWatchMutation.mutateAsync
  }, [deleteWatchMutation.mutateAsync])

  const updateWatchMutation = useMutation({
    mutationFn: async ({
      watchId,
      watchedAt,
    }: {
      watchId: string
      watchedAt: Date
    }) => {
      if (!userId) {
        throw new Error("User must be authenticated to edit watch history")
      }

      await updateWatch(userId, movieId, watchId, watchedAt)
    },
    onMutate: async ({ watchId, watchedAt }) => {
      if (!watchesQueryKey) {
        return { previousWatches: undefined } satisfies WatchMutationContext
      }

      await queryClient.cancelQueries({ queryKey: watchesQueryKey })
      const previousWatches =
        queryClient.getQueryData<WatchInstance[]>(watchesQueryKey)

      queryClient.setQueryData<WatchInstance[]>(watchesQueryKey, (current) =>
        [...(current ?? [])]
          .map((watch) =>
            watch.id === watchId ? { ...watch, watchedAt } : watch,
          )
          .sort((left, right) => right.watchedAt.getTime() - left.watchedAt.getTime()),
      )

      return { previousWatches } satisfies WatchMutationContext
    },
    onError: (_error, _variables, context) => {
      if (!watchesQueryKey || !context) return
      queryClient.setQueryData(watchesQueryKey, context.previousWatches)
    },
    onSettled: () => {
      if (!watchesQueryKey) return
      queryClient.invalidateQueries({ queryKey: watchesQueryKey })
    },
  })

  const updateWatchMutationRef = useRef(updateWatchMutation.mutateAsync)

  useEffect(() => {
    updateWatchMutationRef.current = updateWatchMutation.mutateAsync
  }, [updateWatchMutation.mutateAsync])

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
        const { watchId } = await addWatchMutationRef.current({
          watchedAt,
          isFirstWatch: instances.length === 0,
          movieData,
          autoAddToAlreadyWatched,
          autoRemoveFromShouldWatch,
        })

        showActionableSuccessToast("Marked as watched", {
          action: {
            label: "Undo",
            onClick: async () => {
              await deleteWatch(userId as string, movieId, watchId)

              const remainingWatches = await getWatchCount(userId as string, movieId)
              if (remainingWatches === 0) {
                const resolvedCollectionId = await resolveCollectionId(
                  movieId,
                  movieData.collectionId,
                )

                if (resolvedCollectionId) {
                  await removeWatchedMovieFromTrackedCollection(
                    userId as string,
                    resolvedCollectionId,
                    movieId,
                  )
                }
              }

              if (watchesQueryKey) {
                await queryClient.invalidateQueries({
                  queryKey: watchesQueryKey,
                })
              }
              await queryClient.invalidateQueries({
                queryKey: queryKeys.firestore.collectionTrackingRoot,
              })
            },
            errorMessage: "Failed to undo watch mark",
            logMessage: "Failed to undo watched movie mark:",
          },
        })
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error"
        toast.error(`Failed to mark as watched: ${errorMessage}`)
      }
    },
    [instances.length, movieId, queryClient, userId, watchesQueryKey],
  )

  const clearAllWatches = useCallback(async (): Promise<void> => {
    try {
      const previousWatches = instances.map((watch) => ({
        ...watch,
        watchedAt: new Date(watch.watchedAt),
      }))
      const { removedCollectionIds } = await clearWatchesMutationRef.current()

      showActionableSuccessToast("Watch history cleared", {
        action: {
          label: "Undo",
          onClick: async () => {
            await Promise.all(
              previousWatches.map((watch) =>
                addWatch(userId as string, movieId, watch.watchedAt),
              ),
            )
            await Promise.all(
              removedCollectionIds.map((collectionId) =>
                addWatchedMovieToTrackedCollection(
                  userId as string,
                  collectionId,
                  movieId,
                ),
              ),
            )

            if (watchesQueryKey) {
              await queryClient.invalidateQueries({
                queryKey: watchesQueryKey,
              })
            }
            await queryClient.invalidateQueries({
              queryKey: queryKeys.firestore.collectionTrackingRoot,
            })
          },
          errorMessage: "Failed to restore watch history",
          logMessage: "Failed to undo watch history clear:",
        },
      })
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error"
      toast.error(`Failed to clear watch history: ${errorMessage}`)
      throw error
    }
  }, [instances, movieId, queryClient, userId, watchesQueryKey])

  const deleteWatchInstance = useCallback(
    async (watchId: string): Promise<void> => {
      const deletedWatch =
        (
          (watchesQueryKey
            ? queryClient.getQueryData<WatchInstance[]>(watchesQueryKey)
            : undefined) ?? instances
        ).find((watch) => watch.id === watchId) ?? null
      const previousWatch = deletedWatch
        ? {
            ...deletedWatch,
            watchedAt: new Date(deletedWatch.watchedAt),
          }
        : null

      try {
        await deleteWatchMutationRef.current({ watchId })

        const remainingWatchCount =
          (watchesQueryKey
            ? queryClient.getQueryData<WatchInstance[]>(watchesQueryKey)?.length
            : undefined) ??
          (userId ? await getWatchCount(userId, movieId) : 0)
        let removedCollectionIds: number[] = []

        if (remainingWatchCount === 0 && userId) {
          removedCollectionIds = await syncCollectionTrackingAfterUnwatch(
            userId,
            movieId,
          )
          await queryClient.invalidateQueries({
            queryKey: queryKeys.firestore.collectionTrackingRoot,
          })
        }

        if (!previousWatch) {
          toast.success("Watch deleted")
          return
        }

        showActionableSuccessToast("Watch deleted", {
          action: {
            label: "Undo",
            onClick: async () => {
              await addWatch(userId as string, movieId, previousWatch.watchedAt)
              await Promise.all(
                removedCollectionIds.map((collectionId) =>
                  addWatchedMovieToTrackedCollection(
                    userId as string,
                    collectionId,
                    movieId,
                  ),
                ),
              )

              if (watchesQueryKey) {
                await queryClient.invalidateQueries({
                  queryKey: watchesQueryKey,
                })
              }
              await queryClient.invalidateQueries({
                queryKey: queryKeys.firestore.collectionTrackingRoot,
              })
            },
            errorMessage: "Failed to restore deleted watch",
            logMessage: "Failed to undo watch deletion:",
          },
        })
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error"
        toast.error(`Failed to delete watch: ${errorMessage}`)
        throw error
      }
    },
    [instances, movieId, queryClient, userId, watchesQueryKey],
  )

  const updateWatchInstance = useCallback(
    async (watchId: string, watchedAt: Date): Promise<void> => {
      try {
        await updateWatchMutationRef.current({ watchId, watchedAt })
        toast.success("Watch date updated")
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error"
        toast.error(`Failed to update watch: ${errorMessage}`)
        throw error
      }
    },
    [],
  )

  return {
    instances,
    count: instances.length,
    lastWatchedAt: instances.length > 0 ? instances[0].watchedAt : null,
    isLoading: authLoading || (enabled && isLoading),
    addWatchInstance,
    clearAllWatches,
    deleteWatchInstance,
    updateWatchInstance,
  }
}
