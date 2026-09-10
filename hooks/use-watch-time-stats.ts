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

export interface MonthlyRatedItem {
  mediaId: string
  mediaType: "movie" | "tv" | "episode" | "season"
  title: string
  rating: number
  ratedAt: number
  tvShowId?: number
  seasonNumber?: number
  episodeNumber?: number
}

export interface MonthlyAddedItem {
  listId: string
  itemKey: string
  mediaId: number
  mediaType: "movie" | "tv"
  title: string
  posterPath: string | null
  addedAt: number
}

export interface MonthlyWatchTime {
  /** "YYYY-MM" */
  key: string
  /** e.g. "September 2026" */
  label: string
  totalWatchMinutes: number
  /** Episodes + already-watched items (mobile `watched`). */
  watched: number
  episodeCount: number
  alreadyWatchedCount: number
  ratedCount: number
  addedToListsCount: number
  averageRating: number | null
  /** Top 3 genre names for the month (from list items with genre_ids). */
  topGenres: string[]
  /** Watched-count % change vs the next-older active month; null for oldest. */
  comparisonToPrevious: { watched: number } | null
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
    genreIds?: number[]
    addedAt: number
    minutes: number
  }>
  /** Per-rating rows for the month-detail rated tab (newest first). */
  rated: MonthlyRatedItem[]
  /** All-list adds for the month-detail added tab (movie/tv only, newest first). */
  added: MonthlyAddedItem[]
}

export interface WatchTimeStats {
  totalWatchMinutes: number
  episodeCount: number
  alreadyWatchedCount: number
  ratedCount: number
  /** Items added to any list in the window (mobile `totalAddedToLists`). */
  totalAddedToLists: number
  currentStreak: number
  longestStreak: number
  mostActiveDay: string | null
  mostActiveTimeOfDay: string | null
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

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`
}

/**
 * Consecutive-day streaks over activity timestamps (mobile parity).
 * Day precision, duplicates collapsed. The current streak tolerates a
 * missing today as long as yesterday has activity.
 */
export function calculateStreaks(timestamps: number[]): {
  current: number
  longest: number
} {
  if (timestamps.length === 0) return { current: 0, longest: 0 }

  const uniqueDates = new Set(
    timestamps.map((ts) => dateKey(new Date(ts))),
  )
  const sortedDates = [...uniqueDates].sort()

  let longestStreak = 1
  let tempStreak = 1
  for (let i = 1; i < sortedDates.length; i++) {
    const prevDate = new Date(sortedDates[i - 1] as string)
    const currDate = new Date(sortedDates[i] as string)
    const diffDays = Math.round(
      (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24),
    )
    if (diffDays === 1) {
      tempStreak += 1
      longestStreak = Math.max(longestStreak, tempStreak)
    } else {
      tempStreak = 1
    }
  }

  const todayStr = dateKey(new Date())
  const yesterdayStr = dateKey(new Date(Date.now() - 24 * 60 * 60 * 1000))
  let currentStreak = 0
  const startFrom = uniqueDates.has(todayStr)
    ? Date.now()
    : uniqueDates.has(yesterdayStr)
      ? Date.now() - 24 * 60 * 60 * 1000
      : null
  if (startFrom !== null) {
    currentStreak = 1
    let checkTime = startFrom - 24 * 60 * 60 * 1000
    while (uniqueDates.has(dateKey(new Date(checkTime)))) {
      currentStreak += 1
      checkTime -= 24 * 60 * 60 * 1000
    }
  }

  return { current: currentStreak, longest: longestStreak }
}

const TIME_OF_DAY_PERIODS = [
  { start: 5, end: 12, label: "Morning" },
  { start: 12, end: 17, label: "Afternoon" },
  { start: 17, end: 21, label: "Evening" },
] as const

function timeOfDayLabel(hour: number): string {
  for (const period of TIME_OF_DAY_PERIODS) {
    if (hour >= period.start && hour < period.end) return period.label
  }
  return "Night"
}

/**
 * Most active weekday + time of day over activity timestamps
 * (mobile parity, hardcoded English).
 */
export function analyzePatterns(timestamps: number[]): {
  mostActiveDay: string | null
  mostActiveTimeOfDay: string | null
} {
  if (timestamps.length === 0) {
    return { mostActiveDay: null, mostActiveTimeOfDay: null }
  }

  const dayCounts = new Map<number, number>()
  const timeCounts = new Map<string, number>()
  for (const ts of timestamps) {
    const date = new Date(ts)
    const day = date.getDay()
    dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1)
    const period = timeOfDayLabel(date.getHours())
    timeCounts.set(period, (timeCounts.get(period) ?? 0) + 1)
  }

  let mostActiveDayIndex: number | null = null
  let mostActiveDayCount = 0
  for (const [day, count] of dayCounts) {
    if (count > mostActiveDayCount) {
      mostActiveDayCount = count
      mostActiveDayIndex = day
    }
  }
  // 2021-01-03 was a Sunday, so +index maps getDay() 0-6 to weekday names.
  const mostActiveDay =
    mostActiveDayIndex === null
      ? null
      : new Date(2021, 0, 3 + mostActiveDayIndex).toLocaleDateString("en-US", {
          weekday: "long",
        })

  let mostActiveTimeOfDay: string | null = null
  let mostActiveTimeCount = 0
  for (const [period, count] of timeCounts) {
    if (count > mostActiveTimeCount) {
      mostActiveTimeCount = count
      mostActiveTimeOfDay = period
    }
  }

  return { mostActiveDay, mostActiveTimeOfDay }
}

/** Rounded integer % change; prev==0 yields +100 when current>0 else 0. */
export function calculatePercentageChange(
  current: number,
  previous: number,
): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0
  }
  return Math.round(((current - previous) / previous) * 100)
}

/** Top genre names by id frequency (limit 3, unknown ids dropped). */
export function calculateTopGenres(
  genreIdCounts: Map<number, number>,
  genreMap: Record<number, string>,
  limit = 3,
): string[] {
  return [...genreIdCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => genreMap[id])
    .filter((name): name is string => !!name)
}

/**
 * Compute Total Hours Watched from the existing React Query caches.
 *
 * Reads only (zero new Firestore reads): episode_tracking via
 * useEpisodeTracking, lists via useLists, ratings via useRatingsData.
 * Same rules as mobile's HistoryService: 6-month window, only the
 * `already-watched` list counts toward time, missing runtimes fall back
 * in-memory (45/episode, 0/movie) and are never persisted here.
 * Streaks/patterns count all activity (episodes + ratings + all list adds).
 */
export function useWatchTimeStats(options?: {
  genreMap?: Record<number, string>
}): WatchTimeStats {
  const { user, loading: authLoading } = useAuth()
  const { tracking, loading: trackingLoading } = useEpisodeTracking()
  const { lists, loading: listsLoading } = useLists()
  const { ratings, loading: ratingsLoading } = useRatingsData()

  const userId = user && !user.isAnonymous ? user.uid : null
  const genreMap = options?.genreMap

  return useMemo(() => {
    const loading =
      authLoading || (!!userId && (trackingLoading || listsLoading || ratingsLoading))

    const empty: WatchTimeStats = {
      totalWatchMinutes: 0,
      episodeCount: 0,
      alreadyWatchedCount: 0,
      ratedCount: 0,
      totalAddedToLists: 0,
      currentStreak: 0,
      longestStreak: 0,
      mostActiveDay: null,
      mostActiveTimeOfDay: null,
      months: [],
      unstampedEpisodes: [],
      unstampedListItems: [],
      loading,
    }
    if (!userId) return empty

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

    // All-list adds in the window (streaks, patterns, added tab, genres).
    const recentListItems: Array<{
      listId: string
      itemKey: string
      item: ListMediaItem
    }> = []
    for (const list of lists) {
      if (!list.items) continue
      for (const [itemKey, item] of Object.entries(list.items)) {
        if (item.addedAt && item.addedAt >= cutoff) {
          recentListItems.push({ listId: list.id, itemKey, item })
        }
      }
    }

    // already-watched items (the only list that counts toward time).
    const alreadyWatchedItems = recentListItems.filter(
      ({ listId }) => listId === "already-watched",
    )

    const recentRatings = [...ratings.values()].filter(
      (rating) => rating.ratedAt >= cutoff,
    )

    // Streaks + patterns over all activity (mobile parity).
    const allTimestamps = [
      ...recentEpisodes.map(({ episode }) => episode.watchedAt),
      ...recentListItems.map(({ item }) => item.addedAt),
      ...recentRatings.map((rating) => rating.ratedAt),
    ]
    const { current: currentStreak, longest: longestStreak } =
      calculateStreaks(allTimestamps)
    const { mostActiveDay, mostActiveTimeOfDay } =
      analyzePatterns(allTimestamps)

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
    for (const { item } of recentListItems)
      monthKeys.add(monthKey(item.addedAt))
    for (const rating of recentRatings) monthKeys.add(monthKey(rating.ratedAt))
    const sortedKeys = [...monthKeys].sort().reverse()

    const months: MonthlyWatchTime[] = sortedKeys.map((key, index) => {
      const monthEpisodes = recentEpisodes.filter(
        ({ episode }) => monthKey(episode.watchedAt) === key,
      )
      const monthItems = alreadyWatchedItems.filter(
        ({ item }) => monthKey(item.addedAt) === key,
      )
      const monthRatings = recentRatings.filter(
        (rating) => monthKey(rating.ratedAt) === key,
      )
      const monthListItems = recentListItems.filter(
        ({ item }) => monthKey(item.addedAt) === key,
      )
      const watched = monthEpisodes.length + monthItems.length

      let averageRating: number | null = null
      if (monthRatings.length > 0) {
        averageRating =
          Math.round(
            (monthRatings.reduce((sum, r) => sum + r.rating, 0) /
              monthRatings.length) *
              10,
          ) / 10
      }

      const genreIdCounts = new Map<number, number>()
      for (const { item } of monthListItems) {
        for (const id of item.genre_ids ?? []) {
          genreIdCounts.set(id, (genreIdCounts.get(id) ?? 0) + 1)
        }
      }
      const topGenres = genreMap
        ? calculateTopGenres(genreIdCounts, genreMap)
        : []

      // Month-over-month watched % vs the next-older active month.
      let comparisonToPrevious: { watched: number } | null = null
      if (index < sortedKeys.length - 1) {
        const prevKey = sortedKeys[index + 1] as string
        const prevWatched =
          recentEpisodes.filter(
            ({ episode }) => monthKey(episode.watchedAt) === prevKey,
          ).length +
          alreadyWatchedItems.filter(
            ({ item }) => monthKey(item.addedAt) === prevKey,
          ).length
        comparisonToPrevious = {
          watched: calculatePercentageChange(watched, prevWatched),
        }
      }

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
        watched,
        episodeCount: monthEpisodes.length,
        alreadyWatchedCount: monthItems.length,
        ratedCount: monthRatings.length,
        addedToListsCount: monthListItems.length,
        averageRating,
        topGenres,
        comparisonToPrevious,
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
            genreIds: item.genre_ids,
            addedAt: item.addedAt,
            minutes: listItemMinutes(item),
          }))
          .sort((a, b) => b.addedAt - a.addedAt),
        rated: monthRatings
          .map((rating) => ({
            mediaId: rating.mediaId,
            mediaType: rating.mediaType,
            title: rating.title,
            rating: rating.rating,
            ratedAt: rating.ratedAt,
            tvShowId: rating.tvShowId,
            seasonNumber: rating.seasonNumber,
            episodeNumber: rating.episodeNumber,
          }))
          .sort((a, b) => b.ratedAt - a.ratedAt),
        added: monthListItems
          .filter(
            ({ item }) =>
              item.media_type === "movie" || item.media_type === "tv",
          )
          .map(({ listId, itemKey, item }) => ({
            listId,
            itemKey,
            mediaId: item.id,
            mediaType: item.media_type,
            title: item.title || item.name || "Unknown",
            posterPath: item.poster_path,
            addedAt: item.addedAt,
          }))
          .sort((a, b) => b.addedAt - a.addedAt),
      }
    })

    return {
      totalWatchMinutes,
      episodeCount: recentEpisodes.length,
      alreadyWatchedCount: alreadyWatchedItems.length,
      ratedCount: recentRatings.length,
      totalAddedToLists: recentListItems.length,
      currentStreak,
      longestStreak,
      mostActiveDay,
      mostActiveTimeOfDay,
      months,
      unstampedEpisodes,
      unstampedListItems,
      loading,
    }
  }, [
    authLoading,
    userId,
    tracking,
    lists,
    ratings,
    genreMap,
    trackingLoading,
    listsLoading,
    ratingsLoading,
  ])
}
