"use client"

import { useAuth } from "@/context/auth-context"
import { queryKeys } from "@/lib/react-query/query-keys"
import { episodeTrackingService } from "@/services/episode-tracking-service"
import type {
  EpisodeTrackingMetadata,
  TVShowEpisodeTracking,
  WatchedEpisode,
} from "@/types/episode-tracking"
import type { TMDBEpisode as Episode } from "@/types/tmdb"
import { useMutation, useQueryClient } from "@tanstack/react-query"

type SeasonEpisodeInput = Pick<Episode, "id" | "episode_number" | "name"> & {
  air_date: string | null
}

interface ShowStats {
  totalEpisodes: number
  avgRuntime: number
}

interface NextEpisode {
  season: number
  episode: number
  title: string
  airDate: string | null
}

interface ShowMetadata {
  tvShowName: string
  posterPath: string | null
}

function episodeKey(seasonNumber: number, episodeNumber: number) {
  return `${seasonNumber}_${episodeNumber}`
}

function cloneTracking(
  tracking: TVShowEpisodeTracking | null,
  showMetadata?: ShowMetadata,
): TVShowEpisodeTracking {
  const now = Date.now()

  if (!tracking) {
    return {
      episodes: {},
      metadata: {
        tvShowName: showMetadata?.tvShowName ?? "",
        posterPath: showMetadata?.posterPath ?? null,
        lastUpdated: now,
      },
    }
  }

  return {
    episodes: { ...tracking.episodes },
    metadata: { ...tracking.metadata },
  }
}

function patchMetadata(
  metadata: EpisodeTrackingMetadata,
  showMetadata: ShowMetadata,
  showStats?: ShowStats,
  nextEpisode?: NextEpisode | null,
): EpisodeTrackingMetadata {
  const now = Date.now()

  return {
    ...metadata,
    tvShowName: showMetadata.tvShowName,
    posterPath: showMetadata.posterPath,
    lastUpdated: now,
    ...(showStats && {
      totalEpisodes: showStats.totalEpisodes,
      avgRuntime: showStats.avgRuntime,
    }),
    ...(nextEpisode !== undefined && { nextEpisode }),
  }
}

function setShowInTrackingMap(
  map: Map<string, TVShowEpisodeTracking>,
  tvShowId: number,
  value: TVShowEpisodeTracking | null,
): Map<string, TVShowEpisodeTracking> {
  const nextMap = new Map(map)

  if (value) {
    nextMap.set(tvShowId.toString(), value)
  } else {
    nextMap.delete(tvShowId.toString())
  }

  return nextMap
}

export function useEpisodeTrackingMutations() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const userId = user && !user.isAnonymous ? user.uid : null
  const allTrackingQueryKey = userId
    ? queryKeys.firestore.episodeTrackingAll(userId)
    : null

  const getShowQueryKey = (tvShowId: number) =>
    userId ? queryKeys.firestore.episodeTrackingShow(userId, tvShowId) : null

  const markEpisodeWatchedMutation = useMutation({
    mutationFn: async (variables: {
      tvShowId: number
      seasonNumber: number
      episodeNumber: number
      episodeData: {
        episodeId: number
        episodeName: string
        episodeAirDate: string | null
      }
      showMetadata: ShowMetadata
      showStats?: ShowStats
      nextEpisode?: NextEpisode | null
      markPreviousEpisodesWatched?: boolean
      seasonEpisodes?: SeasonEpisodeInput[]
    }) => {
      await episodeTrackingService.markEpisodeWatched(
        variables.tvShowId,
        variables.seasonNumber,
        variables.episodeNumber,
        variables.episodeData,
        variables.showMetadata,
        variables.showStats,
        variables.nextEpisode,
        variables.markPreviousEpisodesWatched,
        variables.seasonEpisodes,
      )
    },
    onMutate: async (variables) => {
      if (!allTrackingQueryKey || !userId) {
        return {
          previousAll: undefined as Map<string, TVShowEpisodeTracking> | undefined,
          previousShow: undefined as TVShowEpisodeTracking | null | undefined,
        }
      }

      const showQueryKey = getShowQueryKey(variables.tvShowId)
      if (!showQueryKey) {
        return {
          previousAll: undefined as Map<string, TVShowEpisodeTracking> | undefined,
          previousShow: undefined as TVShowEpisodeTracking | null | undefined,
        }
      }

      await Promise.all([
        queryClient.cancelQueries({ queryKey: allTrackingQueryKey }),
        queryClient.cancelQueries({ queryKey: showQueryKey }),
      ])

      const previousAll = queryClient.getQueryData<Map<string, TVShowEpisodeTracking>>(
        allTrackingQueryKey,
      )
      const previousShow = queryClient.getQueryData<TVShowEpisodeTracking | null>(
        showQueryKey,
      )

      const currentShow = cloneTracking(previousShow ?? null, variables.showMetadata)
      const nextShow = cloneTracking(currentShow, variables.showMetadata)
      const now = Date.now()

      const key = episodeKey(variables.seasonNumber, variables.episodeNumber)
      nextShow.episodes[key] = {
        episodeId: variables.episodeData.episodeId,
        tvShowId: variables.tvShowId,
        seasonNumber: variables.seasonNumber,
        episodeNumber: variables.episodeNumber,
        watchedAt: now,
        episodeName: variables.episodeData.episodeName,
        episodeAirDate: variables.episodeData.episodeAirDate,
      }

      if (variables.markPreviousEpisodesWatched && variables.seasonEpisodes?.length) {
        variables.seasonEpisodes.forEach((seasonEpisode) => {
          if (seasonEpisode.episode_number >= variables.episodeNumber) return

          const previousKey = episodeKey(
            variables.seasonNumber,
            seasonEpisode.episode_number,
          )

          if (nextShow.episodes[previousKey]) return

          nextShow.episodes[previousKey] = {
            episodeId: seasonEpisode.id,
            tvShowId: variables.tvShowId,
            seasonNumber: variables.seasonNumber,
            episodeNumber: seasonEpisode.episode_number,
            watchedAt: now,
            episodeName: seasonEpisode.name,
            episodeAirDate: seasonEpisode.air_date,
          }
        })
      }

      nextShow.metadata = patchMetadata(
        nextShow.metadata,
        variables.showMetadata,
        variables.showStats,
        variables.nextEpisode,
      )

      queryClient.setQueryData(showQueryKey, nextShow)

      if (previousAll) {
        queryClient.setQueryData(
          allTrackingQueryKey,
          setShowInTrackingMap(previousAll, variables.tvShowId, nextShow),
        )
      }

      return { previousAll, previousShow }
    },
    onError: (_error, variables, context) => {
      if (!userId) return
      const showQueryKey = getShowQueryKey(variables.tvShowId)
      if (!showQueryKey || !allTrackingQueryKey) return

      if (context?.previousAll) {
        queryClient.setQueryData(allTrackingQueryKey, context.previousAll)
      }
      if (context?.previousShow !== undefined) {
        queryClient.setQueryData(showQueryKey, context.previousShow)
      }
    },
    onSettled: (_data, _error, variables) => {
      if (!userId || !allTrackingQueryKey) return
      const showQueryKey = getShowQueryKey(variables.tvShowId)

      queryClient.invalidateQueries({ queryKey: allTrackingQueryKey })
      if (showQueryKey) {
        queryClient.invalidateQueries({ queryKey: showQueryKey })
      }
    },
  })

  const markEpisodeUnwatchedMutation = useMutation({
    mutationFn: async (variables: {
      tvShowId: number
      seasonNumber: number
      episodeNumber: number
    }) => {
      await episodeTrackingService.markEpisodeUnwatched(
        variables.tvShowId,
        variables.seasonNumber,
        variables.episodeNumber,
      )
    },
    onMutate: async (variables) => {
      if (!allTrackingQueryKey || !userId) {
        return {
          previousAll: undefined as Map<string, TVShowEpisodeTracking> | undefined,
          previousShow: undefined as TVShowEpisodeTracking | null | undefined,
        }
      }

      const showQueryKey = getShowQueryKey(variables.tvShowId)
      if (!showQueryKey) {
        return {
          previousAll: undefined as Map<string, TVShowEpisodeTracking> | undefined,
          previousShow: undefined as TVShowEpisodeTracking | null | undefined,
        }
      }

      await Promise.all([
        queryClient.cancelQueries({ queryKey: allTrackingQueryKey }),
        queryClient.cancelQueries({ queryKey: showQueryKey }),
      ])

      const previousAll = queryClient.getQueryData<Map<string, TVShowEpisodeTracking>>(
        allTrackingQueryKey,
      )
      const previousShow = queryClient.getQueryData<TVShowEpisodeTracking | null>(
        showQueryKey,
      )

      const nextShow = cloneTracking(previousShow ?? null)
      delete nextShow.episodes[
        episodeKey(variables.seasonNumber, variables.episodeNumber)
      ]
      nextShow.metadata.lastUpdated = Date.now()

      const normalizedShow =
        Object.keys(nextShow.episodes).length > 0 ? nextShow : null

      queryClient.setQueryData(showQueryKey, normalizedShow)
      if (previousAll) {
        queryClient.setQueryData(
          allTrackingQueryKey,
          setShowInTrackingMap(previousAll, variables.tvShowId, normalizedShow),
        )
      }

      return { previousAll, previousShow }
    },
    onError: (_error, variables, context) => {
      if (!userId) return
      const showQueryKey = getShowQueryKey(variables.tvShowId)
      if (!showQueryKey || !allTrackingQueryKey) return

      if (context?.previousAll) {
        queryClient.setQueryData(allTrackingQueryKey, context.previousAll)
      }
      if (context?.previousShow !== undefined) {
        queryClient.setQueryData(showQueryKey, context.previousShow)
      }
    },
    onSettled: (_data, _error, variables) => {
      if (!userId || !allTrackingQueryKey) return
      const showQueryKey = getShowQueryKey(variables.tvShowId)

      queryClient.invalidateQueries({ queryKey: allTrackingQueryKey })
      if (showQueryKey) {
        queryClient.invalidateQueries({ queryKey: showQueryKey })
      }
    },
  })

  const markAllEpisodesWatchedMutation = useMutation({
    mutationFn: async (variables: {
      tvShowId: number
      seasonNumber: number
      episodes: SeasonEpisodeInput[]
      showMetadata: ShowMetadata
      showStats?: ShowStats
      nextEpisode?: NextEpisode | null
    }) => {
      await episodeTrackingService.markAllEpisodesWatched(
        variables.tvShowId,
        variables.seasonNumber,
        variables.episodes,
        variables.showMetadata,
        variables.showStats,
        variables.nextEpisode,
      )
    },
    onMutate: async (variables) => {
      if (!allTrackingQueryKey || !userId) {
        return {
          previousAll: undefined as Map<string, TVShowEpisodeTracking> | undefined,
          previousShow: undefined as TVShowEpisodeTracking | null | undefined,
        }
      }

      const showQueryKey = getShowQueryKey(variables.tvShowId)
      if (!showQueryKey) {
        return {
          previousAll: undefined as Map<string, TVShowEpisodeTracking> | undefined,
          previousShow: undefined as TVShowEpisodeTracking | null | undefined,
        }
      }

      await Promise.all([
        queryClient.cancelQueries({ queryKey: allTrackingQueryKey }),
        queryClient.cancelQueries({ queryKey: showQueryKey }),
      ])

      const previousAll = queryClient.getQueryData<Map<string, TVShowEpisodeTracking>>(
        allTrackingQueryKey,
      )
      const previousShow = queryClient.getQueryData<TVShowEpisodeTracking | null>(
        showQueryKey,
      )

      const nextShow = cloneTracking(previousShow ?? null, variables.showMetadata)
      const now = Date.now()

      variables.episodes.forEach((episode) => {
        nextShow.episodes[episodeKey(variables.seasonNumber, episode.episode_number)] = {
          episodeId: episode.id,
          tvShowId: variables.tvShowId,
          seasonNumber: variables.seasonNumber,
          episodeNumber: episode.episode_number,
          watchedAt: now,
          episodeName: episode.name,
          episodeAirDate: episode.air_date,
        }
      })

      nextShow.metadata = patchMetadata(
        nextShow.metadata,
        variables.showMetadata,
        variables.showStats,
        variables.nextEpisode,
      )

      queryClient.setQueryData(showQueryKey, nextShow)

      if (previousAll) {
        queryClient.setQueryData(
          allTrackingQueryKey,
          setShowInTrackingMap(previousAll, variables.tvShowId, nextShow),
        )
      }

      return { previousAll, previousShow }
    },
    onError: (_error, variables, context) => {
      if (!userId) return
      const showQueryKey = getShowQueryKey(variables.tvShowId)
      if (!showQueryKey || !allTrackingQueryKey) return

      if (context?.previousAll) {
        queryClient.setQueryData(allTrackingQueryKey, context.previousAll)
      }
      if (context?.previousShow !== undefined) {
        queryClient.setQueryData(showQueryKey, context.previousShow)
      }
    },
    onSettled: (_data, _error, variables) => {
      if (!userId || !allTrackingQueryKey) return
      const showQueryKey = getShowQueryKey(variables.tvShowId)

      queryClient.invalidateQueries({ queryKey: allTrackingQueryKey })
      if (showQueryKey) {
        queryClient.invalidateQueries({ queryKey: showQueryKey })
      }
    },
  })

  const clearAllEpisodesMutation = useMutation({
    mutationFn: async (variables: { tvShowId: number }) => {
      await episodeTrackingService.clearAllEpisodes(variables.tvShowId)
    },
    onMutate: async (variables) => {
      if (!allTrackingQueryKey || !userId) {
        return {
          previousAll: undefined as Map<string, TVShowEpisodeTracking> | undefined,
          previousShow: undefined as TVShowEpisodeTracking | null | undefined,
        }
      }

      const showQueryKey = getShowQueryKey(variables.tvShowId)
      if (!showQueryKey) {
        return {
          previousAll: undefined as Map<string, TVShowEpisodeTracking> | undefined,
          previousShow: undefined as TVShowEpisodeTracking | null | undefined,
        }
      }

      await Promise.all([
        queryClient.cancelQueries({ queryKey: allTrackingQueryKey }),
        queryClient.cancelQueries({ queryKey: showQueryKey }),
      ])

      const previousAll = queryClient.getQueryData<Map<string, TVShowEpisodeTracking>>(
        allTrackingQueryKey,
      )
      const previousShow = queryClient.getQueryData<TVShowEpisodeTracking | null>(
        showQueryKey,
      )

      queryClient.setQueryData(showQueryKey, null)
      if (previousAll) {
        queryClient.setQueryData(
          allTrackingQueryKey,
          setShowInTrackingMap(previousAll, variables.tvShowId, null),
        )
      }

      return { previousAll, previousShow }
    },
    onError: (_error, variables, context) => {
      if (!userId) return
      const showQueryKey = getShowQueryKey(variables.tvShowId)
      if (!showQueryKey || !allTrackingQueryKey) return

      if (context?.previousAll) {
        queryClient.setQueryData(allTrackingQueryKey, context.previousAll)
      }
      if (context?.previousShow !== undefined) {
        queryClient.setQueryData(showQueryKey, context.previousShow)
      }
    },
    onSettled: (_data, _error, variables) => {
      if (!userId || !allTrackingQueryKey) return
      const showQueryKey = getShowQueryKey(variables.tvShowId)

      queryClient.invalidateQueries({ queryKey: allTrackingQueryKey })
      if (showQueryKey) {
        queryClient.invalidateQueries({ queryKey: showQueryKey })
      }
    },
  })

  return {
    markEpisodeWatched: markEpisodeWatchedMutation.mutateAsync,
    markEpisodeUnwatched: markEpisodeUnwatchedMutation.mutateAsync,
    markAllEpisodesWatched: markAllEpisodesWatchedMutation.mutateAsync,
    clearAllEpisodes: clearAllEpisodesMutation.mutateAsync,
    isMutating:
      markEpisodeWatchedMutation.isPending ||
      markEpisodeUnwatchedMutation.isPending ||
      markAllEpisodesWatchedMutation.isPending ||
      clearAllEpisodesMutation.isPending,
  }
}
