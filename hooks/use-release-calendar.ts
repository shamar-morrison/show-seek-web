"use client"

import { fetchReleaseCalendarReleases } from "@/app/actions"
import { useAuth } from "@/context/auth-context"
import { useLists } from "@/hooks/use-lists"
import { usePreferences } from "@/hooks/use-preferences"
import { getTodayDateKey } from "@/lib/tmdb-date"
import { queryCacheProfiles } from "@/lib/react-query/query-options"
import {
  queryKeys,
  UNAUTHENTICATED_USER_ID,
} from "@/lib/react-query/query-keys"
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

interface UseReleaseCalendarReturn {
  releases: ReleaseCalendarRelease[]
  isLoading: boolean
  isFetching: boolean
  error: Error | null
}

export function useReleaseCalendar(): UseReleaseCalendarReturn {
  const { user, loading: authLoading } = useAuth()
  const { lists, loading: listsLoading } = useLists()
  const { region, isLoading: preferencesLoading } = usePreferences()

  const userId = user && !user.isAnonymous ? user.uid : null
  const trackedItems = useMemo(() => createTrackedItems(lists), [lists])
  const todayKey = getTodayDateKey()
  const itemsSignature = useMemo(
    () => JSON.stringify(trackedItems),
    [trackedItems],
  )

  const query = useQuery({
    ...queryCacheProfiles.status,
    queryKey: queryKeys.calendar.releases(
      userId ?? UNAUTHENTICATED_USER_ID,
      region,
      itemsSignature,
      todayKey,
    ),
    queryFn: async () =>
      fetchReleaseCalendarReleases({
        items: trackedItems,
        region,
        todayKey,
      }),
    enabled:
      !!userId &&
      !listsLoading &&
      !preferencesLoading &&
      trackedItems.length > 0,
  })

  const isLoading =
    authLoading ||
    listsLoading ||
    preferencesLoading ||
    (!!userId && trackedItems.length > 0 && query.isLoading)

  return {
    releases: query.data ?? [],
    isLoading,
    isFetching: query.isFetching,
    error: (query.error as Error | null) ?? null,
  }
}
