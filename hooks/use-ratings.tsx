"use client"

import { useAuth } from "@/context/auth-context"
import { useListMutations } from "@/hooks/use-list-mutations"
import { usePreferences } from "@/hooks/use-preferences"
import {
  deleteEpisodeRating,
  deleteRating,
  fetchRatings,
  setRating,
} from "@/lib/firebase/ratings"
import { queryCacheProfiles } from "@/lib/react-query/query-options"
import {
  queryKeys,
  UNAUTHENTICATED_USER_ID,
} from "@/lib/react-query/query-keys"
import type { Rating } from "@/types/rating"
import {
  type QueryClient,
  type QueryKey,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { useCallback, useMemo } from "react"
import { toast } from "sonner"

/** Sort options for ratings */
export type RatingSortOption = "ratedAt" | "rating" | "alphabetical"

const EMPTY_RATINGS = new Map<string, Rating>()

type RatingsMutationContext = {
  previousRatings: Map<string, Rating> | undefined
}

function ratingsOptimisticConfig<TVariables>(
  queryClient: QueryClient,
  ratingsQueryKey: QueryKey | null,
  applyOptimistic: (
    ratings: Map<string, Rating>,
    variables: TVariables,
    now: number,
  ) => void,
) {
  return {
    onMutate: async (variables: TVariables): Promise<RatingsMutationContext> => {
      if (!ratingsQueryKey) {
        return { previousRatings: undefined }
      }

      await queryClient.cancelQueries({ queryKey: ratingsQueryKey })
      const previousRatings = queryClient.getQueryData<Map<string, Rating>>(
        ratingsQueryKey,
      )

      const nextRatings = new Map(previousRatings ?? [])
      applyOptimistic(nextRatings, variables, Date.now())
      queryClient.setQueryData(ratingsQueryKey, nextRatings)

      return { previousRatings }
    },
    onError: (
      _error: unknown,
      _variables: TVariables,
      context: RatingsMutationContext | undefined,
    ) => {
      if (!ratingsQueryKey) return
      if (context !== undefined) {
        queryClient.setQueryData(ratingsQueryKey, context.previousRatings)
      }
    },
    onSettled: () => {
      if (!ratingsQueryKey) return
      queryClient.invalidateQueries({ queryKey: ratingsQueryKey })
    },
  }
}

/**
 * Read-only ratings data hook used by both list views and full mutation hooks.
 */
export function useRatingsData() {
  const { user, loading: authLoading } = useAuth()

  const userId = user && !user.isAnonymous ? user.uid : null
  const ratingsQueryKey = userId ? queryKeys.firestore.ratings(userId) : null
  const ratingsReadQueryKey = queryKeys.firestore.ratings(
    userId ?? UNAUTHENTICATED_USER_ID,
  )

  const { data: ratings = EMPTY_RATINGS, isLoading } = useQuery({
    ...queryCacheProfiles.status,
    queryKey: ratingsReadQueryKey,
    queryFn: async () => {
      if (!userId) return EMPTY_RATINGS
      return fetchRatings(userId)
    },
    enabled: !!userId,
  })

  return {
    ratings,
    loading: authLoading || (!!userId && isLoading),
    userId,
    ratingsQueryKey,
  }
}

/**
 * Hook for managing user ratings using React Query cached reads and mutations.
 */
export function useRatings() {
  const { preferences } = usePreferences()
  const { addToList } = useListMutations()
  const queryClient = useQueryClient()
  const { ratings, loading, userId, ratingsQueryKey } = useRatingsData()

  const saveRatingMutation = useMutation({
    mutationFn: async (variables: {
      mediaType: "movie" | "tv"
      mediaId: number
      rating: number
      title: string
      posterPath: string | null
      releaseDate: string | null
      voteAverage?: number
    }) => {
      if (!userId) throw new Error("User must be authenticated to rate")

      await setRating(userId, {
        userId,
        id: `${variables.mediaType}-${variables.mediaId}`,
        mediaType: variables.mediaType,
        mediaId: variables.mediaId.toString(),
        rating: variables.rating,
        title: variables.title,
        posterPath: variables.posterPath,
        releaseDate: variables.releaseDate,
      })

      if (
        variables.mediaType === "movie" &&
        preferences.autoAddToAlreadyWatched
      ) {
        try {
          const wasAdded = await addToList("already-watched", {
            id: variables.mediaId,
            title: variables.title,
            poster_path: variables.posterPath,
            media_type: "movie",
            vote_average: variables.voteAverage,
            release_date: variables.releaseDate || undefined,
          })

          if (wasAdded) {
            toast.success("Added to Already Watched list")
          }
        } catch (listError) {
          console.error("Failed to auto-add to Already Watched list:", listError)
        }
      }
    },
    ...ratingsOptimisticConfig(
      queryClient,
      ratingsQueryKey,
      (nextRatings, variables, now) => {
        const key = `${variables.mediaType}-${variables.mediaId}`
        nextRatings.set(key, {
          id: key,
          mediaId: variables.mediaId.toString(),
          mediaType: variables.mediaType,
          rating: variables.rating,
          title: variables.title,
          posterPath: variables.posterPath,
          releaseDate: variables.releaseDate,
          ratedAt: now,
        })
      },
    ),
  })

  const removeRatingMutation = useMutation({
    mutationFn: async (variables: { mediaType: "movie" | "tv"; mediaId: number }) => {
      if (!userId) {
        throw new Error("User must be authenticated to remove rating")
      }

      await deleteRating(userId, variables.mediaType, variables.mediaId)
    },
    ...ratingsOptimisticConfig(
      queryClient,
      ratingsQueryKey,
      (nextRatings, variables) => {
        nextRatings.delete(`${variables.mediaType}-${variables.mediaId}`)
      },
    ),
  })

  const saveEpisodeRatingMutation = useMutation({
    mutationFn: async (variables: {
      tvShowId: number
      seasonNumber: number
      episodeNumber: number
      rating: number
      episodeName: string
      tvShowName: string
      posterPath: string | null
      episodeAirDate: string | null
    }) => {
      if (!userId) throw new Error("User must be authenticated to rate")

      await setRating(userId, {
        userId,
        id: `episode-${variables.tvShowId}-${variables.seasonNumber}-${variables.episodeNumber}`,
        mediaType: "episode",
        mediaId: variables.tvShowId.toString(),
        rating: variables.rating,
        title: variables.episodeName,
        posterPath: variables.posterPath,
        releaseDate: variables.episodeAirDate,
        tvShowId: variables.tvShowId,
        tvShowName: variables.tvShowName,
        seasonNumber: variables.seasonNumber,
        episodeNumber: variables.episodeNumber,
      })
    },
    ...ratingsOptimisticConfig(
      queryClient,
      ratingsQueryKey,
      (nextRatings, variables, now) => {
        const key = `episode-${variables.tvShowId}-${variables.seasonNumber}-${variables.episodeNumber}`
        nextRatings.set(key, {
          id: key,
          mediaId: variables.tvShowId.toString(),
          mediaType: "episode",
          rating: variables.rating,
          title: variables.episodeName,
          posterPath: variables.posterPath,
          releaseDate: variables.episodeAirDate,
          ratedAt: now,
          tvShowId: variables.tvShowId,
          seasonNumber: variables.seasonNumber,
          episodeNumber: variables.episodeNumber,
          episodeName: variables.episodeName,
          tvShowName: variables.tvShowName,
        })
      },
    ),
  })

  const removeEpisodeRatingMutation = useMutation({
    mutationFn: async (variables: {
      tvShowId: number
      seasonNumber: number
      episodeNumber: number
    }) => {
      if (!userId) {
        throw new Error("User must be authenticated to remove rating")
      }

      await deleteEpisodeRating(
        userId,
        variables.tvShowId,
        variables.seasonNumber,
        variables.episodeNumber,
      )
    },
    ...ratingsOptimisticConfig(
      queryClient,
      ratingsQueryKey,
      (nextRatings, variables) => {
        nextRatings.delete(
          `episode-${variables.tvShowId}-${variables.seasonNumber}-${variables.episodeNumber}`,
        )
      },
    ),
  })

  const { mutateAsync: saveRatingAsync } = saveRatingMutation
  const { mutateAsync: removeRatingAsync } = removeRatingMutation
  const { mutateAsync: saveEpisodeRatingAsync } = saveEpisodeRatingMutation
  const { mutateAsync: removeEpisodeRatingAsync } = removeEpisodeRatingMutation

  const getRating = useCallback(
    (mediaType: "movie" | "tv", mediaId: number): Rating | null => {
      const key = `${mediaType}-${mediaId}`
      return ratings.get(key) || null
    },
    [ratings],
  )

  const saveRating = useCallback(
    async (
      mediaType: "movie" | "tv",
      mediaId: number,
      rating: number,
      title: string,
      posterPath: string | null,
      releaseDate: string | null = null,
      voteAverage?: number,
    ): Promise<void> => {
      await saveRatingAsync({
        mediaType,
        mediaId,
        rating,
        title,
        posterPath,
        releaseDate,
        voteAverage,
      })
    },
    [saveRatingAsync],
  )

  const removeRating = useCallback(
    async (mediaType: "movie" | "tv", mediaId: number): Promise<void> => {
      await removeRatingAsync({ mediaType, mediaId })
    },
    [removeRatingAsync],
  )

  const getEpisodeRating = useCallback(
    (
      tvShowId: number,
      seasonNumber: number,
      episodeNumber: number,
    ): Rating | null => {
      const key = `episode-${tvShowId}-${seasonNumber}-${episodeNumber}`
      return ratings.get(key) || null
    },
    [ratings],
  )

  const saveEpisodeRating = useCallback(
    async (
      tvShowId: number,
      seasonNumber: number,
      episodeNumber: number,
      rating: number,
      episodeName: string,
      tvShowName: string,
      posterPath: string | null,
      episodeAirDate: string | null = null,
    ): Promise<void> => {
      await saveEpisodeRatingAsync({
        tvShowId,
        seasonNumber,
        episodeNumber,
        rating,
        episodeName,
        tvShowName,
        posterPath,
        episodeAirDate,
      })
    },
    [saveEpisodeRatingAsync],
  )

  const removeEpisodeRating = useCallback(
    async (
      tvShowId: number,
      seasonNumber: number,
      episodeNumber: number,
    ): Promise<void> => {
      await removeEpisodeRatingAsync({
        tvShowId,
        seasonNumber,
        episodeNumber,
      })
    },
    [removeEpisodeRatingAsync],
  )

  return {
    ratings,
    loading,
    getRating,
    saveRating,
    removeRating,
    getEpisodeRating,
    saveEpisodeRating,
    removeEpisodeRating,
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
      case "alphabetical": {
        // Sort by TV show name, then by season, then by episode
        const showCompare = (a.tvShowName || "").localeCompare(
          b.tvShowName || "",
        )
        if (showCompare !== 0) return showCompare
        const seasonCompare = (a.seasonNumber || 0) - (b.seasonNumber || 0)
        if (seasonCompare !== 0) return seasonCompare
        return (a.episodeNumber || 0) - (b.episodeNumber || 0)
      }
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
  const { ratings, loading: ratingsLoading } = useRatingsData()

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
  const { ratings, loading: ratingsLoading } = useRatingsData()

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
  const { ratings, loading: ratingsLoading } = useRatingsData()

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
