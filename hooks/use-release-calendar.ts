"use client"

import { fetchReleaseCalendarReleases } from "@/app/actions"
import { useAuth } from "@/context/auth-context"
import { useLists } from "@/hooks/use-lists"
import { usePreferences } from "@/hooks/use-preferences"
import {
  dedupeTrackedItems,
  deriveReleaseCalendarReleases,
} from "@/lib/release-calendar"
import { queryCacheProfiles } from "@/lib/react-query/query-options"
import {
  queryKeys,
  UNAUTHENTICATED_USER_ID,
} from "@/lib/react-query/query-keys"
import { getTodayDateKey } from "@/lib/tmdb-date"
import type {
  ReleaseCalendarRelease,
  ReleaseCalendarTrackedItem,
  TrackedCalendarListId,
} from "@/types/release-calendar"
import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"

const TRACKED_LIST_IDS = [
  "watchlist",
  "favorites",
  "currently-watching",
] as const satisfies readonly TrackedCalendarListId[]

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

function buildTrackedItemsSignature(
  items: ReturnType<typeof dedupeTrackedItems>,
): string {
  return JSON.stringify(
    items.map((item) => ({
      firstAirDate: item.firstAirDate ?? null,
      id: item.id,
      mediaType: item.mediaType,
      name: item.name ?? null,
      posterPath: item.posterPath,
      releaseDate: item.releaseDate ?? null,
      sourceLists: item.sourceLists,
      title: item.title,
    })),
  )
}

interface UseReleaseCalendarReturn {
  releases: ReleaseCalendarRelease[]
  isBootstrapping: boolean
  isRefreshing: boolean
  error: Error | null
}

export function useReleaseCalendar(): UseReleaseCalendarReturn {
  const { user, loading: authLoading } = useAuth()
  const { lists, loading: listsLoading, error: listsError } = useLists()
  const { region } = usePreferences()

  const userId = user && !user.isAnonymous ? user.uid : null
  const todayKey = useMemo(() => getTodayDateKey(), [])
  const trackedItems = useMemo(() => createTrackedItems(lists), [lists])
  const dedupedTrackedItems = useMemo(
    () => dedupeTrackedItems(trackedItems),
    [trackedItems],
  )
  const trackedItemsSignature = useMemo(
    () => buildTrackedItemsSignature(dedupedTrackedItems),
    [dedupedTrackedItems],
  )

  const fallbackReleases = useMemo(
    () =>
      deriveReleaseCalendarReleases({
        items: dedupedTrackedItems,
        region,
        todayKey,
      }),
    [dedupedTrackedItems, region, todayKey],
  )

  const enrichmentEnabled =
    !!userId &&
    !authLoading &&
    !listsLoading &&
    trackedItems.length > 0

  const calendarQuery = useQuery({
    ...queryCacheProfiles.profile,
    queryKey: queryKeys.calendar.releases(
      userId ?? UNAUTHENTICATED_USER_ID,
      region,
      todayKey,
      trackedItemsSignature,
    ),
    queryFn: async () =>
      fetchReleaseCalendarReleases({
        items: trackedItems,
        region,
        todayKey,
      }),
    enabled: enrichmentEnabled,
    placeholderData: (previousData) => previousData ?? fallbackReleases,
  })

  const releases = calendarQuery.data ?? fallbackReleases
  const calendarError = (calendarQuery.error as Error | null) ?? null

  return {
    releases,
    isBootstrapping: authLoading || listsLoading,
    isRefreshing:
      !!userId &&
      trackedItems.length > 0 &&
      calendarQuery.isFetching,
    error: listsError ?? (releases.length === 0 ? calendarError : null),
  }
}
