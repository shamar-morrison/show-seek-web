"use client"

import { useAuth } from "@/context/auth-context"
import { queryKeys } from "@/lib/react-query/query-keys"
import { episodeTrackingService } from "@/services/episode-tracking-service"
import type {
  EpisodeTrackingMetadata,
  TVShowEpisodeTracking,
} from "@/types/episode-tracking"
import type { SeasonEpisodeInput } from "@/types/episode-tracking-inputs"
import { useMutation, useQueryClient } from "@tanstack/react-query"

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

interface EpisodeWatchedVariables {
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
}

function episodeKey(seasonNumber: number, episodeNumber: number) {
  return `${seasonNumber}_${episodeNumber}`
}

// `cloneTracking` intentionally shallow-clones `TVShowEpisodeTracking` fields.
// Callers must avoid mutating nested values in-place to preserve optimistic cache safety.
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

  type TrackingMutationContext = {
    previousAll: Map<string, TVShowEpisodeTracking> | undefined
    previousShow: TVShowEpisodeTracking | null | undefined
    showQueryKey: readonly unknown[] | null
  }

  function useTrackingMutation<TVariables>({
    getTvShowId,
    mutationFn,
    applyOptimistic,
  }: {
    getTvShowId: (variables: TVariables) => number
    mutationFn: (variables: TVariables) => Promise<void>
    applyOptimistic: (params: {
      previousShow: TVShowEpisodeTracking | null | undefined
      variables: TVariables
    }) => TVShowEpisodeTracking | null
  }) {
    return useMutation<void, Error, TVariables, TrackingMutationContext>({
      mutationFn,
      onMutate: async (variables) => {
        if (!allTrackingQueryKey || !userId) {
          return {
            previousAll: undefined,
            previousShow: undefined,
            showQueryKey: null,
          }
        }

        const tvShowId = getTvShowId(variables)
        const showQueryKey = getShowQueryKey(tvShowId)
        if (!showQueryKey) {
          return {
            previousAll: undefined,
            previousShow: undefined,
            showQueryKey: null,
          }
        }

        await Promise.all([
          queryClient.cancelQueries({ queryKey: allTrackingQueryKey }),
          queryClient.cancelQueries({ queryKey: showQueryKey }),
        ])

        const previousAll = queryClient.getQueryData<
          Map<string, TVShowEpisodeTracking>
        >(allTrackingQueryKey)
        const previousShow = queryClient.getQueryData<TVShowEpisodeTracking | null>(
          showQueryKey,
        )
        const nextShow = applyOptimistic({ previousShow, variables })

        queryClient.setQueryData(showQueryKey, nextShow)
        if (previousAll) {
          queryClient.setQueryData(
            allTrackingQueryKey,
            setShowInTrackingMap(previousAll, tvShowId, nextShow),
          )
        }

        return { previousAll, previousShow, showQueryKey }
      },
      onError: (_error, _variables, context) => {
        if (!allTrackingQueryKey || !context?.showQueryKey) return

        if (context.previousAll !== undefined) {
          queryClient.setQueryData(allTrackingQueryKey, context.previousAll)
        }
        if (context.previousShow !== undefined) {
          queryClient.setQueryData(context.showQueryKey, context.previousShow)
        }
      },
      onSettled: (_data, _error, variables, context) => {
        if (!allTrackingQueryKey || !userId) return

        const showQueryKey =
          context?.showQueryKey ?? getShowQueryKey(getTvShowId(variables))
        queryClient.invalidateQueries({ queryKey: allTrackingQueryKey })
        if (showQueryKey) {
          queryClient.invalidateQueries({ queryKey: showQueryKey })
        }
      },
    })
  }

  const markEpisodeWatchedMutation = useTrackingMutation<EpisodeWatchedVariables>({
    getTvShowId: (variables) => variables.tvShowId,
    mutationFn: async (variables) => {
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
    applyOptimistic: ({ previousShow, variables }) => {
      const nextShow = cloneTracking(previousShow ?? null, variables.showMetadata)
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

      return nextShow
    },
  })

  const markEpisodeUnwatchedMutation = useTrackingMutation({
    getTvShowId: (variables: {
      tvShowId: number
      seasonNumber: number
      episodeNumber: number
    }) => variables.tvShowId,
    mutationFn: async (variables) => {
      await episodeTrackingService.markEpisodeUnwatched(
        variables.tvShowId,
        variables.seasonNumber,
        variables.episodeNumber,
      )
    },
    applyOptimistic: ({ previousShow, variables }) => {
      const nextShow = cloneTracking(previousShow ?? null)
      delete nextShow.episodes[
        episodeKey(variables.seasonNumber, variables.episodeNumber)
      ]
      nextShow.metadata.lastUpdated = Date.now()
      return Object.keys(nextShow.episodes).length > 0 ? nextShow : null
    },
  })

  const markAllEpisodesWatchedMutation = useTrackingMutation({
    getTvShowId: (variables: {
      tvShowId: number
      seasonNumber: number
      episodes: SeasonEpisodeInput[]
      showMetadata: ShowMetadata
      showStats?: ShowStats
      nextEpisode?: NextEpisode | null
    }) => variables.tvShowId,
    mutationFn: async (variables) => {
      await episodeTrackingService.markAllEpisodesWatched(
        variables.tvShowId,
        variables.seasonNumber,
        variables.episodes,
        variables.showMetadata,
        variables.showStats,
        variables.nextEpisode,
      )
    },
    applyOptimistic: ({ previousShow, variables }) => {
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

      return nextShow
    },
  })

  const markAllEpisodesUnwatchedMutation = useTrackingMutation({
    getTvShowId: (variables: {
      tvShowId: number
      seasonNumber: number
      episodeNumbers: number[]
    }) => variables.tvShowId,
    mutationFn: async (variables) => {
      await episodeTrackingService.markAllEpisodesUnwatched(
        variables.tvShowId,
        variables.seasonNumber,
        variables.episodeNumbers,
      )
    },
    applyOptimistic: ({ previousShow, variables }) => {
      const nextShow = cloneTracking(previousShow ?? null)
      variables.episodeNumbers.forEach((episodeNumber) => {
        delete nextShow.episodes[episodeKey(variables.seasonNumber, episodeNumber)]
      })
      nextShow.metadata.lastUpdated = Date.now()
      return Object.keys(nextShow.episodes).length > 0 ? nextShow : null
    },
  })

  const clearAllEpisodesMutation = useTrackingMutation({
    getTvShowId: (variables: { tvShowId: number }) => variables.tvShowId,
    mutationFn: async (variables) => {
      await episodeTrackingService.clearAllEpisodes(variables.tvShowId)
    },
    applyOptimistic: () => null,
  })

  return {
    markEpisodeWatched: markEpisodeWatchedMutation.mutateAsync,
    markEpisodeUnwatched: markEpisodeUnwatchedMutation.mutateAsync,
    markAllEpisodesWatched: markAllEpisodesWatchedMutation.mutateAsync,
    markAllEpisodesUnwatched: markAllEpisodesUnwatchedMutation.mutateAsync,
    clearAllEpisodes: clearAllEpisodesMutation.mutateAsync,
    isMutating:
      markEpisodeWatchedMutation.isPending ||
      markEpisodeUnwatchedMutation.isPending ||
      markAllEpisodesWatchedMutation.isPending ||
      markAllEpisodesUnwatchedMutation.isPending ||
      clearAllEpisodesMutation.isPending,
  }
}
