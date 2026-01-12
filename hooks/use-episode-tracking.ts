"use client"

import { useAuth } from "@/context/auth-context"
import { parseEpisodeKey } from "@/lib/episode-utils"
import { subscribeToAllEpisodeTracking } from "@/lib/firebase/episode-tracking"
import type {
  InProgressShow,
  TVShowEpisodeTracking,
  WatchedEpisode,
} from "@/types/episode-tracking"
import { useCallback, useEffect, useState } from "react"

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
      } => e.parsed !== null && e.parsed.season > 0, // Exclude season 0
    )

  if (parsedEpisodes.length === 0) return null

  // Find most recently watched for lastWatchedEpisode
  const sortedByTime = [...parsedEpisodes].sort(
    (a, b) => b.data.watchedAt - a.data.watchedAt,
  )
  const lastWatched = sortedByTime[0]

  // Use cached values from metadata, or fallback to reasonable defaults
  const totalEpisodes = metadata.totalEpisodes ?? 0
  const avgRuntime = metadata.avgRuntime ?? DEFAULT_AVG_RUNTIME
  const watchedCount = parsedEpisodes.length

  // Calculate percentage (only if we have totalEpisodes cached)
  const percentage =
    totalEpisodes > 0 ? Math.round((watchedCount / totalEpisodes) * 100) : 0

  // Calculate remaining time
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
    // Use cached nextEpisode from metadata (can be null if caught up, undefined if not computed)
    nextEpisode: metadata.nextEpisode ?? null,
    watchedCount,
    totalEpisodes,
    avgRuntime,
  }
}

/**
 * Hook for managing episode tracking with real-time updates.
 *
 * This hook reads episode tracking data from Firebase and uses cached TMDB
 * metadata stored in the tracking documents. No TMDB API calls are made here -
 * the enrichment data is written when marking episodes as watched.
 *
 * For legacy data without cached stats, fallback defaults are used.
 */
export function useEpisodeTracking() {
  const { user, loading: authLoading } = useAuth()
  const [tracking, setTracking] = useState<Map<string, TVShowEpisodeTracking>>(
    new Map(),
  )
  const [loading, setLoading] = useState(true)
  const [watchProgress, setWatchProgress] = useState<WatchProgressItem[]>([])
  const [watchedEpisodesByShow, setWatchedEpisodesByShow] = useState<
    Map<number, Set<string>>
  >(new Map())

  // Subscribe to real-time tracking updates
  useEffect(() => {
    if (authLoading) return
    if (!user || user.isAnonymous) {
      setTracking(new Map())
      setWatchProgress([])
      setWatchedEpisodesByShow(new Map())
      setLoading(false)
      return
    }

    setLoading(true)
    const unsubscribe = subscribeToAllEpisodeTracking(
      user.uid,
      (trackingMap) => {
        setTracking(trackingMap)

        // Compute progress immediately from cached data - no async needed!
        const results: WatchProgressItem[] = []
        const episodesByShow = new Map<number, Set<string>>()

        for (const [tvShowIdStr, data] of trackingMap.entries()) {
          const tvShowId = parseInt(tvShowIdStr, 10)
          const progress = computeProgressFromCache(tvShowId, data)
          if (progress) {
            results.push(progress)
          }

          // Collect watched episode keys for this show
          const keys = new Set(Object.keys(data.episodes))
          episodesByShow.set(tvShowId, keys)
        }

        // Sort by last updated (most recent first)
        results.sort((a, b) => b.lastUpdated - a.lastUpdated)
        setWatchProgress(results)
        setWatchedEpisodesByShow(episodesByShow)
        setLoading(false)
      },
      () => setLoading(false),
    )

    return () => unsubscribe()
  }, [user, authLoading])

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
    loading,
    getShowProgress,
  }
}
