"use client"

import { useAuth } from "@/context/auth-context"
import { subscribeToAllEpisodeTracking } from "@/lib/firebase/episode-tracking"
import type {
  InProgressShow,
  TVShowEpisodeTracking,
  WatchedEpisode,
} from "@/types/episode-tracking"
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
 * Fetch TMDB show details
 */
async function fetchShowDetails(
  tvShowId: number,
): Promise<TMDBShowData | null> {
  try {
    const response = await fetch(`/api/tv/${tvShowId}/details`)
    if (!response.ok) return null
    const data = await response.json()
    const avgRuntime =
      data.episode_run_time?.length > 0
        ? data.episode_run_time[0] // Use first runtime (most common)
        : 45
    return {
      totalEpisodes: data.number_of_episodes || 0,
      avgRuntime,
      seasons: data.seasons || [],
    }
  } catch {
    return null
  }
}

/**
 * Fetch season episodes from TMDB
 */
async function fetchSeasonEpisodes(
  tvShowId: number,
  seasonNumber: number,
): Promise<TMDBEpisodeData[]> {
  try {
    const response = await fetch(`/api/tv/${tvShowId}/season/${seasonNumber}`)
    if (!response.ok) return []
    const data = await response.json()
    return data.episodes || []
  } catch {
    return []
  }
}

/**
 * Find the next episode to watch
 * Returns the first aired, unwatched episode after the furthest watched
 */
async function findNextEpisode(
  tvShowId: number,
  watchedEpisodes: Record<string, WatchedEpisode>,
  furthestWatched: { season: number; episode: number },
): Promise<{
  season: number
  episode: number
  title: string
  airDate: string | null
} | null> {
  const today = new Date()

  // Fetch current season and potentially next season
  const currentSeasonEpisodes = await fetchSeasonEpisodes(
    tvShowId,
    furthestWatched.season,
  )

  // First, check remaining episodes in current season
  for (const ep of currentSeasonEpisodes) {
    if (ep.episode_number <= furthestWatched.episode) continue

    // Check if aired
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

  // If no more in current season, check next season
  const nextSeasonEpisodes = await fetchSeasonEpisodes(
    tvShowId,
    furthestWatched.season + 1,
  )

  for (const ep of nextSeasonEpisodes) {
    if (ep.air_date && new Date(ep.air_date) <= today) {
      const key = buildEpisodeKey(furthestWatched.season + 1, ep.episode_number)
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

  return null // Caught up or no more aired episodes
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
  const [tracking, setTracking] = useState<Map<string, TVShowEpisodeTracking>>(
    new Map(),
  )
  const [loading, setLoading] = useState(true)
  const [enrichedProgress, setEnrichedProgress] = useState<WatchProgressItem[]>(
    [],
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
      return
    }

    const enrichAll = async () => {
      const results: WatchProgressItem[] = []

      for (const [tvShowIdStr, data] of tracking.entries()) {
        const tvShowId = parseInt(tvShowIdStr, 10)
        const basic = computeBasicProgress(tvShowId, data) as
          | (WatchProgressItem & {
              _furthestWatched?: { season: number; episode: number }
              _episodes?: Record<string, WatchedEpisode>
            })
          | null

        if (!basic) continue

        // Fetch TMDB data
        const showData = await fetchShowDetails(tvShowId)
        if (showData) {
          basic.totalEpisodes = showData.totalEpisodes
          basic.avgRuntime = showData.avgRuntime

          // Calculate percentage
          if (showData.totalEpisodes > 0) {
            basic.percentage = Math.round(
              (basic.watchedCount / showData.totalEpisodes) * 100,
            )
          }

          // Calculate time remaining
          const remainingEpisodes = Math.max(
            0,
            showData.totalEpisodes - basic.watchedCount,
          )
          basic.timeRemaining = remainingEpisodes * showData.avgRuntime
        }

        // Find next episode
        if (basic._furthestWatched && basic._episodes) {
          const nextEp = await findNextEpisode(
            tvShowId,
            basic._episodes,
            basic._furthestWatched,
          )
          if (nextEp) {
            basic.nextEpisode = nextEp
          }
        }

        // Clean internal props
        delete basic._furthestWatched
        delete basic._episodes

        results.push(basic)
      }

      // Sort by last updated
      results.sort((a, b) => b.lastUpdated - a.lastUpdated)
      setEnrichedProgress(results)
    }

    enrichAll()
  }, [tracking])

  const getShowProgress = useCallback(
    (tvShowId: number): WatchProgressItem | null => {
      return enrichedProgress.find((p) => p.tvShowId === tvShowId) || null
    },
    [enrichedProgress],
  )

  return {
    tracking,
    watchProgress: enrichedProgress,
    loading,
    getShowProgress,
  }
}
