"use client"

import { useAuth } from "@/context/auth-context"
import { parseEpisodeKey } from "@/lib/episode-utils"
import { fetchAllEpisodeTracking } from "@/lib/firebase/episode-tracking"
import { queryCacheProfiles } from "@/lib/react-query/query-options"
import {
  queryKeys,
  UNAUTHENTICATED_USER_ID,
} from "@/lib/react-query/query-keys"
import type {
  InProgressShow,
  TVShowEpisodeTracking,
  WatchedEpisode,
} from "@/types/episode-tracking"
import { useQuery } from "@tanstack/react-query"
import { useCallback, useMemo } from "react"

/** Default average runtime if not cached (typical TV episode length) */
const DEFAULT_AVG_RUNTIME = 45

/**
 * Enriched progress with TMDB data
 */
export interface WatchProgressItem extends InProgressShow {
  watchedCount: number
  totalEpisodes: number
  avgRuntime: number
}

/**
 * Format remaining time as human-readable string
 */
export function formatRemainingTime(minutes: number): string {
  if (minutes <= 0) return ""
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours === 0) return `${mins}m left`
  if (mins === 0) return `${hours}h left`
  return `${hours}h ${mins}m left`
}

/**
 * Compute progress data from tracking document using cached metadata.
 * No TMDB API calls required - all data comes from Firebase.
 */
function computeProgressFromCache(
  tvShowId: number,
  tracking: TVShowEpisodeTracking,
): WatchProgressItem | null {
  const { episodes, metadata } = tracking
  const watchedKeys = Object.keys(episodes)

  if (watchedKeys.length === 0) return null

  const parsedEpisodes = watchedKeys
    .map((key) => ({
      key,
      parsed: parseEpisodeKey(key),
      data: episodes[key],
    }))
    .filter(
      (
        e,
      ): e is {
        key: string
        parsed: NonNullable<ReturnType<typeof parseEpisodeKey>>
        data: WatchedEpisode
      } => e.parsed !== null && e.parsed.season > 0,
    )

  if (parsedEpisodes.length === 0) return null

  const sortedByTime = [...parsedEpisodes].sort(
    (a, b) => b.data.watchedAt - a.data.watchedAt,
  )
  const lastWatched = sortedByTime[0]

  const watchedCount = parsedEpisodes.length
  const totalEpisodes = metadata.totalEpisodes ?? Math.max(watchedCount, 1)
  const avgRuntime = metadata.avgRuntime ?? DEFAULT_AVG_RUNTIME
  const safeTotal = Math.max(totalEpisodes, 1)
  const rawPercentage = Math.round((watchedCount / safeTotal) * 100)
  const percentage = Math.min(100, Math.max(0, rawPercentage))

  const remainingEpisodes = Math.max(0, totalEpisodes - watchedCount)
  const timeRemaining = remainingEpisodes * avgRuntime

  return {
    tvShowId,
    tvShowName: metadata.tvShowName,
    posterPath: metadata.posterPath,
    backdropPath: null,
    lastUpdated: metadata.lastUpdated,
    percentage,
    timeRemaining,
    lastWatchedEpisode: {
      season: lastWatched.parsed.season,
      episode: lastWatched.parsed.episode,
      title: lastWatched.data.episodeName,
    },
    nextEpisode: metadata.nextEpisode ?? null,
    watchedCount,
    totalEpisodes,
    avgRuntime,
  }
}

/**
 * Hook for managing episode tracking using React Query cached reads.
 */
export function useEpisodeTracking() {
  const { user, loading: authLoading } = useAuth()
  const emptyTracking = useMemo(() => new Map<string, TVShowEpisodeTracking>(), [])

  const userId = user && !user.isAnonymous ? user.uid : null

  const { data: tracking = emptyTracking, isLoading } = useQuery({
    ...queryCacheProfiles.status,
    queryKey: queryKeys.firestore.episodeTrackingAll(
      userId ?? UNAUTHENTICATED_USER_ID,
    ),
    queryFn: async () => {
      if (!userId) return emptyTracking
      return fetchAllEpisodeTracking(userId)
    },
    enabled: !!userId,
  })

  const watchProgress = useMemo(() => {
    const results: WatchProgressItem[] = []

    for (const [tvShowIdStr, data] of tracking.entries()) {
      const tvShowId = parseInt(tvShowIdStr, 10)
      if (Number.isNaN(tvShowId)) continue
      const progress = computeProgressFromCache(tvShowId, data)
      if (progress) {
        results.push(progress)
      }
    }

    results.sort((a, b) => b.lastUpdated - a.lastUpdated)
    return results
  }, [tracking])

  const watchedEpisodesByShow = useMemo(() => {
    const episodesByShow = new Map<number, Set<string>>()

    for (const [tvShowIdStr, data] of tracking.entries()) {
      const tvShowId = parseInt(tvShowIdStr, 10)
      if (Number.isNaN(tvShowId)) continue
      episodesByShow.set(tvShowId, new Set(Object.keys(data.episodes)))
    }

    return episodesByShow
  }, [tracking])

  const getShowProgress = useCallback(
    (tvShowId: number): WatchProgressItem | null => {
      return watchProgress.find((p) => p.tvShowId === tvShowId) || null
    },
    [watchProgress],
  )

  return {
    tracking,
    watchProgress,
    watchedEpisodesByShow,
    loading: authLoading || (!!userId && isLoading),
    getShowProgress,
  }
}
