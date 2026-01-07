"use client"

import { useAuth } from "@/context/auth-context"
import { tmdbQueryKeys } from "@/hooks/use-tmdb-queries"
import { subscribeToAllEpisodeTracking } from "@/lib/firebase/episode-tracking"
import type {
  InProgressShow,
  TVShowEpisodeTracking,
  WatchedEpisode,
} from "@/types/episode-tracking"
import { useQueryClient } from "@tanstack/react-query"
import { useCallback, useEffect, useState } from "react"

/**
 * Parse episode key (e.g., "1_3") to season and episode numbers
 * Format: {seasonNumber}_{episodeNumber}
 */
function parseEpisodeKey(
  key: string,
): { season: number; episode: number } | null {
  const match = key.match(/^(\d+)_(\d+)$/)
  if (!match) return null
  return {
    season: parseInt(match[1], 10),
    episode: parseInt(match[2], 10),
  }
}

/**
 * Build episode key for lookup
 */
function buildEpisodeKey(season: number, episode: number): string {
  return `${season}_${episode}`
}

/**
 * Episode data from TMDB
 */
interface TMDBEpisodeData {
  id: number
  episode_number: number
  name: string
  air_date: string | null
  runtime: number | null
}

/**
 * TV Show details from TMDB
 */
interface TMDBShowData {
  totalEpisodes: number
  avgRuntime: number
  seasons: Array<{
    season_number: number
    episode_count: number
    air_date: string | null
  }>
}

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
 * Compute basic progress data from tracking document
 */
function computeBasicProgress(
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

  // Find furthest watched (highest season, then highest episode)
  const sortedBySeason = [...parsedEpisodes].sort((a, b) => {
    if (a.parsed.season !== b.parsed.season)
      return b.parsed.season - a.parsed.season
    return b.parsed.episode - a.parsed.episode
  })
  const furthestWatched = sortedBySeason[0]

  // Find most recently watched for lastWatchedEpisode
  const sortedByTime = [...parsedEpisodes].sort(
    (a, b) => b.data.watchedAt - a.data.watchedAt,
  )
  const lastWatched = sortedByTime[0]

  return {
    tvShowId,
    tvShowName: metadata.tvShowName,
    posterPath: metadata.posterPath,
    backdropPath: null,
    lastUpdated: metadata.lastUpdated,
    percentage: 0,
    timeRemaining: 0,
    lastWatchedEpisode: {
      season: lastWatched.parsed.season,
      episode: lastWatched.parsed.episode,
      title: lastWatched.data.episodeName,
    },
    nextEpisode: null, // Will be enriched
    watchedCount: parsedEpisodes.length,
    totalEpisodes: 0,
    avgRuntime: 45,
    // Store for enrichment
    _furthestWatched: furthestWatched.parsed,
    _episodes: tracking.episodes,
  } as WatchProgressItem & {
    _furthestWatched: { season: number; episode: number }
    _episodes: Record<string, WatchedEpisode>
  }
}

/**
 * Hook for managing episode tracking with real-time updates
 */
export function useEpisodeTracking() {
  const { user, loading: authLoading } = useAuth()
  const queryClient = useQueryClient()
  const [tracking, setTracking] = useState<Map<string, TVShowEpisodeTracking>>(
    new Map(),
  )
  const [loading, setLoading] = useState(true)
  const [enriching, setEnriching] = useState(false)
  const [enrichedProgress, setEnrichedProgress] = useState<WatchProgressItem[]>(
    [],
  )

  // Fetch show details using React Query cache
  const fetchShowDetails = useCallback(
    async (
      tvShowId: number,
      signal?: AbortSignal,
    ): Promise<TMDBShowData | null> => {
      try {
        return await queryClient.fetchQuery({
          queryKey: tmdbQueryKeys.tvShowDetails(tvShowId),
          queryFn: async (): Promise<TMDBShowData | null> => {
            const response = await fetch(`/api/tv/${tvShowId}/details`, {
              signal,
            })
            if (!response.ok) return null
            const data = await response.json()
            const avgRuntime =
              data.episode_run_time?.length > 0 ? data.episode_run_time[0] : 45
            return {
              totalEpisodes: data.number_of_episodes || 0,
              avgRuntime,
              seasons: data.seasons || [],
            }
          },
        })
      } catch {
        return null
      }
    },
    [queryClient],
  )

  // Fetch season episodes using React Query cache
  const fetchSeasonEpisodes = useCallback(
    async (
      tvShowId: number,
      seasonNumber: number,
      signal?: AbortSignal,
    ): Promise<TMDBEpisodeData[]> => {
      try {
        return await queryClient.fetchQuery({
          queryKey: tmdbQueryKeys.seasonEpisodes(tvShowId, seasonNumber),
          queryFn: async (): Promise<TMDBEpisodeData[]> => {
            const response = await fetch(
              `/api/tv/${tvShowId}/season/${seasonNumber}`,
              { signal },
            )
            if (!response.ok) return []
            const data = await response.json()
            return data.episodes || []
          },
        })
      } catch {
        return []
      }
    },
    [queryClient],
  )

  // Find next episode to watch
  const findNextEpisode = useCallback(
    async (
      tvShowId: number,
      watchedEpisodes: Record<string, WatchedEpisode>,
      furthestWatched: { season: number; episode: number },
      signal?: AbortSignal,
    ): Promise<{
      season: number
      episode: number
      title: string
      airDate: string | null
    } | null> => {
      const today = new Date()

      const currentSeasonEpisodes = await fetchSeasonEpisodes(
        tvShowId,
        furthestWatched.season,
        signal,
      )

      for (const ep of currentSeasonEpisodes) {
        if (ep.episode_number <= furthestWatched.episode) continue
        if (ep.air_date && new Date(ep.air_date) <= today) {
          const key = buildEpisodeKey(furthestWatched.season, ep.episode_number)
          if (!(key in watchedEpisodes)) {
            return {
              season: furthestWatched.season,
              episode: ep.episode_number,
              title: ep.name,
              airDate: ep.air_date,
            }
          }
        }
      }

      const nextSeasonEpisodes = await fetchSeasonEpisodes(
        tvShowId,
        furthestWatched.season + 1,
        signal,
      )

      for (const ep of nextSeasonEpisodes) {
        if (ep.air_date && new Date(ep.air_date) <= today) {
          const key = buildEpisodeKey(
            furthestWatched.season + 1,
            ep.episode_number,
          )
          if (!(key in watchedEpisodes)) {
            return {
              season: furthestWatched.season + 1,
              episode: ep.episode_number,
              title: ep.name,
              airDate: ep.air_date,
            }
          }
        }
      }

      return null
    },
    [fetchSeasonEpisodes],
  )

  // Subscribe to real-time tracking updates
  useEffect(() => {
    if (authLoading) return
    if (!user || user.isAnonymous) {
      setTracking(new Map())
      setLoading(false)
      return
    }

    setLoading(true)
    const unsubscribe = subscribeToAllEpisodeTracking(
      user.uid,
      (trackingMap) => {
        setTracking(trackingMap)
        setLoading(false)
      },
      () => setLoading(false),
    )

    return () => unsubscribe()
  }, [user, authLoading])

  // Enrich with TMDB data
  useEffect(() => {
    if (tracking.size === 0) {
      setEnrichedProgress([])
      setEnriching(false)
      return
    }

    setEnriching(true)

    const controller = new AbortController()
    const { signal } = controller

    const enrichAll = async () => {
      const results: WatchProgressItem[] = []

      for (const [tvShowIdStr, data] of tracking.entries()) {
        if (signal.aborted) return

        const tvShowId = parseInt(tvShowIdStr, 10)
        const basic = computeBasicProgress(tvShowId, data) as
          | (WatchProgressItem & {
              _furthestWatched?: { season: number; episode: number }
              _episodes?: Record<string, WatchedEpisode>
            })
          | null

        if (!basic) continue

        const showData = await fetchShowDetails(tvShowId, signal)
        if (signal.aborted) return

        if (showData) {
          basic.totalEpisodes = showData.totalEpisodes
          basic.avgRuntime = showData.avgRuntime

          if (showData.totalEpisodes > 0) {
            basic.percentage = Math.round(
              (basic.watchedCount / showData.totalEpisodes) * 100,
            )
          }

          const remainingEpisodes = Math.max(
            0,
            showData.totalEpisodes - basic.watchedCount,
          )
          basic.timeRemaining = remainingEpisodes * showData.avgRuntime
        }

        if (basic._furthestWatched && basic._episodes) {
          const nextEp = await findNextEpisode(
            tvShowId,
            basic._episodes,
            basic._furthestWatched,
            signal,
          )
          if (signal.aborted) return

          if (nextEp) {
            basic.nextEpisode = nextEp
          }
        }

        delete basic._furthestWatched
        delete basic._episodes

        results.push(basic)
      }

      if (!signal.aborted) {
        results.sort((a, b) => b.lastUpdated - a.lastUpdated)
        setEnrichedProgress(results)
        setEnriching(false)
      }
    }

    enrichAll()

    return () => controller.abort()
  }, [tracking, fetchShowDetails, findNextEpisode])

  const getShowProgress = useCallback(
    (tvShowId: number): WatchProgressItem | null => {
      return enrichedProgress.find((p) => p.tvShowId === tvShowId) || null
    },
    [enrichedProgress],
  )

  return {
    tracking,
    watchProgress: enrichedProgress,
    loading: loading || enriching,
    getShowProgress,
  }
}
