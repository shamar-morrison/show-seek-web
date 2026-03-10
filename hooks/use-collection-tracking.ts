"use client"

import { fetchCollectionsBatch } from "@/app/actions"
import { useAuth } from "@/context/auth-context"
import {
  MAX_FREE_COLLECTIONS,
  addWatchedMovieToTrackedCollection,
  fetchAllTrackedCollections,
  fetchCollectionTracking,
  getPreviouslyWatchedMovieIds,
  getTrackedCollectionCount,
  removeWatchedMovieFromTrackedCollection,
  startCollectionTracking,
  stopCollectionTracking,
} from "@/lib/firebase/collection-tracking"
import { queryCacheProfiles } from "@/lib/react-query/query-options"
import {
  UNAUTHENTICATED_USER_ID,
  queryKeys,
} from "@/lib/react-query/query-keys"
import type {
  CollectionProgressItem,
  TrackedCollection,
} from "@/types/collection-tracking"
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"

const COLLECTION_STALE_TIME_MS = 7 * 24 * 60 * 60 * 1000
const COLLECTION_GC_TIME_MS = 30 * 24 * 60 * 60 * 1000

export function useTrackedCollections() {
  const { user } = useAuth()
  const userId = user && !user.isAnonymous ? user.uid : null

  const query = useQuery({
    ...queryCacheProfiles.status,
    queryKey: queryKeys.firestore.collectionTrackingAll(
      userId ?? UNAUTHENTICATED_USER_ID,
    ),
    queryFn: async () => {
      if (!userId) return []
      return fetchAllTrackedCollections(userId)
    },
    enabled: !!userId,
  })

  return {
    collections: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
  }
}

export function useCollectionTracking(collectionId: number) {
  const { user } = useAuth()
  const userId = user && !user.isAnonymous ? user.uid : null

  const query = useQuery({
    ...queryCacheProfiles.status,
    queryKey: queryKeys.firestore.collectionTrackingSingle(
      userId ?? UNAUTHENTICATED_USER_ID,
      collectionId,
    ),
    queryFn: async () => {
      if (!userId) return null
      return fetchCollectionTracking(userId, collectionId)
    },
    enabled: !!userId && collectionId > 0,
  })

  const tracking = query.data ?? null
  const watchedCount = tracking?.watchedMovieIds.length ?? 0
  const totalMovies = tracking?.totalMovies ?? 0
  const percentage =
    totalMovies > 0 ? Math.round((watchedCount / totalMovies) * 100) : 0

  return {
    tracking,
    isTracked: tracking !== null,
    watchedCount,
    totalMovies,
    percentage,
    isLoading: query.isLoading,
    error: query.error,
  }
}

export function useCanTrackMoreCollections() {
  const { user, isPremium } = useAuth()
  const userId = user && !user.isAnonymous ? user.uid : null

  const query = useQuery({
    ...queryCacheProfiles.status,
    staleTime: 5 * 60 * 1000,
    queryKey: queryKeys.firestore.collectionTrackingCount(
      userId ?? UNAUTHENTICATED_USER_ID,
    ),
    queryFn: async () => {
      if (!userId) return 0
      return getTrackedCollectionCount(userId)
    },
    enabled: !!userId,
  })

  const count = query.data ?? 0

  return {
    count,
    canTrackMore: isPremium || count < MAX_FREE_COLLECTIONS,
    isLoading: query.isLoading,
    maxFreeCollections: MAX_FREE_COLLECTIONS,
  }
}

interface StartCollectionTrackingInput {
  collectionId: number
  name: string
  totalMovies: number
  initialWatchedMovieIds?: number[]
  collectionMovieIds?: number[]
}

export function useStartCollectionTracking() {
  const { user, isPremium } = useAuth()
  const queryClient = useQueryClient()
  const userId = user && !user.isAnonymous ? user.uid : null

  return useMutation({
    mutationFn: async ({
      collectionId,
      name,
      totalMovies,
      initialWatchedMovieIds,
      collectionMovieIds,
    }: StartCollectionTrackingInput) => {
      if (!userId) {
        throw new Error("Please sign in to continue")
      }

      let watchedMovieIds = initialWatchedMovieIds ?? []

      if (
        initialWatchedMovieIds === undefined &&
        Array.isArray(collectionMovieIds) &&
        collectionMovieIds.length > 0
      ) {
        try {
          watchedMovieIds = await getPreviouslyWatchedMovieIds(
            userId,
            collectionMovieIds,
          )
        } catch (error) {
          console.warn(
            "[useStartCollectionTracking] Failed to backfill watched history:",
            error,
          )
          watchedMovieIds = []
        }
      }

      await startCollectionTracking(
        userId,
        collectionId,
        name,
        totalMovies,
        watchedMovieIds,
        { isPremium },
      )
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.firestore.collectionTrackingRoot,
      })
    },
  })
}

export function useStopCollectionTracking() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const userId = user && !user.isAnonymous ? user.uid : null

  return useMutation({
    mutationFn: async ({ collectionId }: { collectionId: number }) => {
      if (!userId) {
        throw new Error("Please sign in to continue")
      }

      return stopCollectionTracking(userId, collectionId)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.firestore.collectionTrackingRoot,
      })
    },
  })
}

export function useAddWatchedMovieToCollection() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const userId = user && !user.isAnonymous ? user.uid : null

  return useMutation({
    mutationFn: async ({
      collectionId,
      movieId,
    }: {
      collectionId: number
      movieId: number
    }) => {
      if (!userId) {
        throw new Error("Please sign in to continue")
      }

      await addWatchedMovieToTrackedCollection(userId, collectionId, movieId)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.firestore.collectionTrackingRoot,
      })
    },
  })
}

export function useRemoveWatchedMovieFromCollection() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const userId = user && !user.isAnonymous ? user.uid : null

  return useMutation({
    mutationFn: async ({
      collectionId,
      movieId,
    }: {
      collectionId: number
      movieId: number
    }) => {
      if (!userId) {
        throw new Error("Please sign in to continue")
      }

      await removeWatchedMovieFromTrackedCollection(
        userId,
        collectionId,
        movieId,
      )
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.firestore.collectionTrackingRoot,
      })
    },
  })
}

function buildProgressItem(
  trackedCollection: TrackedCollection,
  posterPath: string | null,
  backdropPath: string | null,
): CollectionProgressItem {
  const watchedCount = trackedCollection.watchedMovieIds.length
  const percentage =
    trackedCollection.totalMovies > 0
      ? Math.round((watchedCount / trackedCollection.totalMovies) * 100)
      : 0

  return {
    collectionId: trackedCollection.collectionId,
    name: trackedCollection.name,
    posterPath,
    backdropPath,
    watchedCount,
    totalMovies: trackedCollection.totalMovies,
    percentage,
    lastUpdated: trackedCollection.lastUpdated,
  }
}

export function useCollectionProgressList() {
  const { collections, isLoading: isLoadingTracking } = useTrackedCollections()
  const collectionIds = collections.map(
    (trackedCollection) => trackedCollection.collectionId,
  )

  const collectionArtworkQuery = useQuery({
    queryKey: ["collections", collectionIds] as const,
    queryFn: () => fetchCollectionsBatch(collectionIds),
    staleTime: COLLECTION_STALE_TIME_MS,
    gcTime: COLLECTION_GC_TIME_MS,
    enabled: collectionIds.length > 0,
  })

  const progressItems = collections.map((trackedCollection, index) => {
    const collectionArtwork = collectionArtworkQuery.data?.[index] ?? null

    return buildProgressItem(
      trackedCollection,
      collectionArtwork?.poster_path ?? null,
      collectionArtwork?.backdrop_path ?? null,
    )
  })

  const isLoading =
    isLoadingTracking ||
    (collectionIds.length > 0 && collectionArtworkQuery.isLoading)

  return {
    progressItems,
    isLoading,
    isEmpty: !isLoading && progressItems.length === 0,
  }
}
