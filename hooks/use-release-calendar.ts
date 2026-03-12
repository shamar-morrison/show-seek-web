"use client"

import {
  fetchFullTVDetails,
  fetchMovieDetails,
  fetchSeasonEpisodes,
} from "@/app/actions"
import { useAuth } from "@/context/auth-context"
import { useLists } from "@/hooks/use-lists"
import { usePreferences } from "@/hooks/use-preferences"
import {
  buildReleaseCalendarSeasonRequests,
  dedupeTrackedItems,
  deriveReleaseCalendarReleases,
  type ReleaseCalendarSeasonData,
} from "@/lib/release-calendar"
import { createRateLimitedQueryFn } from "@/lib/react-query/rate-limited-query"
import { getTodayDateKey } from "@/lib/tmdb-date"
import { queryCacheProfiles } from "@/lib/react-query/query-options"
import { queryKeys } from "@/lib/react-query/query-keys"
import type {
  ReleaseCalendarRelease,
  ReleaseCalendarTrackedItem,
  TrackedCalendarListId,
} from "@/types/release-calendar"
import { useMemo } from "react"
import { useQueries } from "@tanstack/react-query"

const TRACKED_LIST_IDS = [
  "watchlist",
  "favorites",
  "currently-watching",
] as const satisfies readonly TrackedCalendarListId[]
const SEASON_STALE_TIME = 15 * 60 * 1000

function createTrackedItems(lists: ReturnType<typeof useLists>["lists"]) {
  const trackedItems: ReleaseCalendarTrackedItem[] = []

  for (const listId of TRACKED_LIST_IDS) {
    const list = lists.find((candidate) => candidate.id === listId)
    if (!list) {
      continue
    }

    for (const item of Object.values(list.items)) {
      trackedItems.push({
        id: item.id,
        mediaType: item.media_type,
        title: item.title,
        name: item.name,
        posterPath: item.poster_path,
        releaseDate: item.release_date,
        firstAirDate: item.first_air_date,
        sourceList: listId,
      })
    }
  }

  return trackedItems.sort((left, right) => {
    if (left.sourceList !== right.sourceList) {
      return left.sourceList.localeCompare(right.sourceList)
    }

    if (left.mediaType !== right.mediaType) {
      return left.mediaType.localeCompare(right.mediaType)
    }

    return left.id - right.id
  })
}

interface UseReleaseCalendarReturn {
  releases: ReleaseCalendarRelease[]
  isLoading: boolean
  isFetching: boolean
  error: Error | null
}

export function useReleaseCalendar(): UseReleaseCalendarReturn {
  const { user, loading: authLoading } = useAuth()
  const { lists, loading: listsLoading, error: listsError } = useLists()
  const { region, isLoading: preferencesLoading } = usePreferences()

  const userId = user && !user.isAnonymous ? user.uid : null
  const trackedItems = useMemo(() => createTrackedItems(lists), [lists])
  const todayKey = useMemo(() => getTodayDateKey(), [])
  const dedupedTrackedItems = useMemo(
    () => dedupeTrackedItems(trackedItems),
    [trackedItems],
  )
  const movieItems = useMemo(
    () => dedupedTrackedItems.filter((item) => item.mediaType === "movie"),
    [dedupedTrackedItems],
  )
  const tvItems = useMemo(
    () => dedupedTrackedItems.filter((item) => item.mediaType === "tv"),
    [dedupedTrackedItems],
  )
  const enrichmentEnabled =
    !!userId &&
    !authLoading &&
    !listsLoading &&
    !preferencesLoading &&
    dedupedTrackedItems.length > 0

  const movieDetailsQueries = useQueries({
    queries: movieItems.map((item) => ({
      ...queryCacheProfiles.profile,
      queryKey: queryKeys.calendar.movieDetails(item.id),
      queryFn: createRateLimitedQueryFn(async () => fetchMovieDetails(item.id)),
      enabled: enrichmentEnabled,
    })),
  })

  const tvDetailsQueries = useQueries({
    queries: tvItems.map((item) => ({
      ...queryCacheProfiles.profile,
      queryKey: queryKeys.calendar.tvDetails(item.id),
      queryFn: createRateLimitedQueryFn(async () => fetchFullTVDetails(item.id)),
      enabled: enrichmentEnabled,
    })),
  })

  const movieDetailsMap = useMemo(() => {
    const detailsById = new Map<number, Awaited<ReturnType<typeof fetchMovieDetails>>>()

    movieDetailsQueries.forEach((query, index) => {
      const item = movieItems[index]
      if (!item || query.data === undefined) {
        return
      }

      detailsById.set(item.id, query.data)
    })

    return detailsById
  }, [movieDetailsQueries, movieItems])

  const tvDetailsMap = useMemo(() => {
    const detailsById = new Map<number, Awaited<ReturnType<typeof fetchFullTVDetails>>>()

    tvDetailsQueries.forEach((query, index) => {
      const item = tvItems[index]
      if (!item || query.data === undefined) {
        return
      }

      detailsById.set(item.id, query.data)
    })

    return detailsById
  }, [tvDetailsQueries, tvItems])

  const seasonRequests = useMemo(
    () => buildReleaseCalendarSeasonRequests(tvItems, tvDetailsMap),
    [tvDetailsMap, tvItems],
  )

  const seasonQueries = useQueries({
    queries: seasonRequests.map((request) => ({
      ...queryCacheProfiles.profile,
      staleTime: SEASON_STALE_TIME,
      queryKey: queryKeys.calendar.seasonEpisodes(
        request.showId,
        request.seasonNumber,
      ),
      queryFn: createRateLimitedQueryFn(async () => ({
        episodes: await fetchSeasonEpisodes(request.showId, request.seasonNumber),
        seasonNumber: request.seasonNumber,
      })),
      enabled: enrichmentEnabled,
    })),
  })

  const seasonDataByShowId = useMemo(() => {
    const seasonData = new Map<number, ReleaseCalendarSeasonData>()

    seasonQueries.forEach((query, index) => {
      const request = seasonRequests[index]
      if (!request || !query.data?.episodes?.length) {
        return
      }

      seasonData.set(request.showId, {
        episodes: query.data.episodes.map((episode) => ({
          airDate: episode.air_date,
          episodeName: episode.name,
          episodeNumber: episode.episode_number,
          seasonNumber: query.data.seasonNumber,
        })),
      })
    })

    return seasonData
  }, [seasonQueries, seasonRequests])

  const releases = useMemo(
    () =>
      deriveReleaseCalendarReleases({
        items: dedupedTrackedItems,
        movieDetailsById: movieDetailsMap,
        region,
        seasonDataByShowId,
        todayKey,
        tvDetailsById: tvDetailsMap,
      }),
    [
      dedupedTrackedItems,
      movieDetailsMap,
      region,
      seasonDataByShowId,
      todayKey,
      tvDetailsMap,
    ],
  )

  const hasPendingInitialEnrichment =
    !!userId &&
    dedupedTrackedItems.length > 0 &&
    releases.length === 0 &&
    [
      ...movieDetailsQueries,
      ...tvDetailsQueries,
      ...seasonQueries,
    ].some((query) => query.isPending)

  const isFetching = [...movieDetailsQueries, ...tvDetailsQueries, ...seasonQueries].some(
    (query) => query.isFetching,
  )

  const isLoading =
    authLoading ||
    listsLoading ||
    preferencesLoading ||
    hasPendingInitialEnrichment

  return {
    releases,
    isLoading,
    isFetching,
    error: listsError,
  }
}
