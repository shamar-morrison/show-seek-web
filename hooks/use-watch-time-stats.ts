"use client"

import { useAuth } from "@/context/auth-context"
import { useEpisodeTracking } from "@/hooks/use-episode-tracking"
import { useLists } from "@/hooks/use-lists"
import { useRatingsData } from "@/hooks/use-ratings"
import type { ListMediaItem } from "@/types/list"
import type { WatchedEpisode } from "@/types/episode-tracking"
import { useMemo } from "react"

/** Fallback minutes per episode when no measured runtime is stamped. */
export const EPISODE_RUNTIME_FALLBACK_MINUTES = 45
/** Number of trailing calendar months in the stats window (mobile parity). */
export const WATCH_TIME_MONTHS_BACK = 6

export interface WatchTimeListRef {
  listId: string
  itemKey: string
  mediaType: "movie" | "tv"
  mediaId: number
  runtimeMinutes?: number
  addedAt: number
}

export interface WatchTimeEpisodeRef {
  tvShowId: number
  episodeKey: string
  runtimeMinutes?: number
  watchedAt: number
}

export interface MonthlyWatchTime {
  /** "YYYY-MM" */
  key: string
  /** e.g. "September 2026" */
  label: string
  totalWatchMinutes: number
  episodeCount: number
  alreadyWatchedCount: number
  ratedCount: number
  /** Per-episode rows for the month-detail drill-down. */
  episodes: Array<{
    tvShowId: number
    tvShowName: string
    seasonNumber: number
    episodeNumber: number
    episodeName: string
    watchedAt: number
    minutes: number
  }>
  /** Per-item already-watched rows for the month-detail drill-down. */
  items: Array<{
    mediaId: number
    mediaType: "movie" | "tv"
    title: string
    addedAt: number
    minutes: number
  }>
}

export interface WatchTimeStats {
  totalWatchMinutes: number
  episodeCount: number
  alreadyWatchedCount: number
  ratedCount: number
  months: MonthlyWatchTime[]
  /** Entries missing measured runtimes (backfill candidates). */
  unstampedEpisodes: WatchTimeEpisodeRef[]
  unstampedListItems: WatchTimeListRef[]
  loading: boolean
}

function monthKey(timestamp: number): string {
  const date = new Date(timestamp)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

function monthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number)
  return new Date(year, (month ?? 1) - 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  })
}

/** First millisecond of the month N months ago (mobile parity). */
function monthsAgoTimestamp(months: number): number {
  const date = new Date()
  date.setMonth(date.getMonth() - months)
  date.setDate(1)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

function episodeMinutes(episode: WatchedEpisode): number {
  if (episode.runtimeMinutes != null && episode.runtimeMinutes > 0) {
    return episode.runtimeMinutes
  }
  return EPISODE_RUNTIME_FALLBACK_MINUTES
}

function listItemMinutes(item: {
  runtimeMinutes?: number
  media_type: "movie" | "tv"
}): number {
  if (item.runtimeMinutes != null && item.runtimeMinutes > 0) {
    return item.runtimeMinutes
  }
  return item.media_type === "movie" ? 0 : EPISODE_RUNTIME_FALLBACK_MINUTES
}

/**
 * Compute Total Hours Watched from the existing React Query caches.
 *
 * Reads only (zero new Firestore reads): episode_tracking via
 * useEpisodeTracking, lists via useLists, ratings via useRatingsData.
 * Same rules as mobile's HistoryService: 6-month window, only the
 * `already-watched` list counts toward time, missing runtimes fall back
 * in-memory (45/episode, 0/movie) and are never persisted here.
 */
export function useWatchTimeStats(): WatchTimeStats {
  const { user, loading: authLoading } = useAuth()
  const { tracking, loading: trackingLoading } = useEpisodeTracking()
  const { lists, loading: listsLoading } = useLists()
  const { ratings, loading: ratingsLoading } = useRatingsData()

  const userId = user && !user.isAnonymous ? user.uid : null

  return useMemo(() => {
    const loading =
      authLoading || (!!userId && (trackingLoading || listsLoading || ratingsLoading))

    if (!userId) {
      return {
        totalWatchMinutes: 0,
        episodeCount: 0,
        alreadyWatchedCount: 0,
        ratedCount: 0,
        months: [],
        unstampedEpisodes: [],
        unstampedListItems: [],
        loading,
      }
    }

    const cutoff = monthsAgoTimestamp(WATCH_TIME_MONTHS_BACK)

    // Flatten recent episodes across all shows (key retained for backfill refs).
    const recentEpisodes: Array<{
      episode: WatchedEpisode
      key: string
      tvShowName: string
    }> = []
    for (const doc of tracking.values()) {
      for (const [episodeKey, episode] of Object.entries(doc.episodes)) {
        if (episode.watchedAt >= cutoff) {
          recentEpisodes.push({
            episode,
            key: episodeKey,
            tvShowName: doc.metadata.tvShowName,
          })
        }
      }
    }

    // already-watched items (the only list that counts toward time).
    const alreadyWatchedItems: Array<{
      itemKey: string
      item: ListMediaItem
    }> = []
    for (const list of lists) {
      if (list.id !== "already-watched" || !list.items) continue
      for (const [itemKey, item] of Object.entries(list.items)) {
        if (item.addedAt && item.addedAt >= cutoff) {
          alreadyWatchedItems.push({ itemKey, item })
        }
      }
    }

    const recentRatings = [...ratings.values()].filter(
      (rating) => rating.ratedAt >= cutoff,
    )

    const unstampedEpisodes: WatchTimeEpisodeRef[] = recentEpisodes
      .filter(
        ({ episode }) =>
          !(episode.runtimeMinutes != null && episode.runtimeMinutes > 0),
      )
      .map(({ episode, key }) => ({
        tvShowId: episode.tvShowId,
        episodeKey: key,
        runtimeMinutes: episode.runtimeMinutes,
        watchedAt: episode.watchedAt,
      }))

    const unstampedListItems: WatchTimeListRef[] = alreadyWatchedItems
      .filter(
        ({ item }) => !(item.runtimeMinutes != null && item.runtimeMinutes > 0),
      )
      .map(({ itemKey, item }) => ({
        listId: "already-watched",
        itemKey,
        mediaType: item.media_type,
        mediaId: item.id,
        runtimeMinutes: item.runtimeMinutes,
        addedAt: item.addedAt,
      }))

    const totalWatchMinutes =
      recentEpisodes.reduce(
        (sum, { episode }) => sum + episodeMinutes(episode),
        0,
      ) +
      alreadyWatchedItems.reduce(
        (sum, { item }) => sum + listItemMinutes(item),
        0,
      )

    // Group by calendar month (newest first).
    const monthKeys = new Set<string>()
    for (const { episode } of recentEpisodes)
      monthKeys.add(monthKey(episode.watchedAt))
    for (const { item } of alreadyWatchedItems)
      monthKeys.add(monthKey(item.addedAt))
    for (const rating of recentRatings) monthKeys.add(monthKey(rating.ratedAt))
    const sortedKeys = [...monthKeys].sort().reverse()

    const months: MonthlyWatchTime[] = sortedKeys.map((key) => {
      const monthEpisodes = recentEpisodes.filter(
        ({ episode }) => monthKey(episode.watchedAt) === key,
      )
      const monthItems = alreadyWatchedItems.filter(
        ({ item }) => monthKey(item.addedAt) === key,
      )
      const monthRatings = recentRatings.filter(
        (rating) => monthKey(rating.ratedAt) === key,
      )
      return {
        key,
        label: monthLabel(key),
        totalWatchMinutes:
          monthEpisodes.reduce(
            (sum, { episode }) => sum + episodeMinutes(episode),
            0,
          ) +
          monthItems.reduce(
            (sum, { item }) => sum + listItemMinutes(item),
            0,
          ),
        episodeCount: monthEpisodes.length,
        alreadyWatchedCount: monthItems.length,
        ratedCount: monthRatings.length,
        episodes: monthEpisodes
          .map(({ episode, tvShowName }) => ({
            tvShowId: episode.tvShowId,
            tvShowName,
            seasonNumber: episode.seasonNumber,
            episodeNumber: episode.episodeNumber,
            episodeName: episode.episodeName,
            watchedAt: episode.watchedAt,
            minutes: episodeMinutes(episode),
          }))
          .sort((a, b) => b.watchedAt - a.watchedAt),
        items: monthItems
          .map(({ item }) => ({
            mediaId: item.id,
            mediaType: item.media_type,
            title: item.title || item.name || "Unknown",
            addedAt: item.addedAt,
            minutes: listItemMinutes(item),
          }))
          .sort((a, b) => b.addedAt - a.addedAt),
      }
    })

    return {
      totalWatchMinutes,
      episodeCount: recentEpisodes.length,
      alreadyWatchedCount: alreadyWatchedItems.length,
      ratedCount: recentRatings.length,
      months,
      unstampedEpisodes,
      unstampedListItems,
      loading,
    }
  }, [authLoading, userId, tracking, lists, ratings, trackingLoading, listsLoading, ratingsLoading])
}
