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
import { mapWithConcurrencyLimit } from "@/lib/utils/concurrency"
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
const RELEASE_CALENDAR_CHUNK_SIZE = 20
const RELEASE_CALENDAR_FETCH_CONCURRENCY = 2

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

function getTrackedItemKey(
  item: Pick<ReleaseCalendarTrackedItem, "id" | "mediaType">,
): string {
  return `${item.mediaType}-${item.id}`
}

function buildTrackedItemChunks({
  trackedItems,
  dedupedTrackedItems,
}: {
  trackedItems: ReleaseCalendarTrackedItem[]
  dedupedTrackedItems: ReturnType<typeof dedupeTrackedItems>
}): ReleaseCalendarTrackedItem[][] {
  const rawItemsByKey = new Map<string, ReleaseCalendarTrackedItem[]>()

  for (const item of trackedItems) {
    const key = getTrackedItemKey(item)
    const existingItems = rawItemsByKey.get(key)

    if (existingItems) {
      existingItems.push(item)
      continue
    }

    rawItemsByKey.set(key, [item])
  }

  const orderedGroups = dedupedTrackedItems
    .map((item) => rawItemsByKey.get(getTrackedItemKey(item)) ?? [])
    .filter((items) => items.length > 0)

  const chunks: ReleaseCalendarTrackedItem[][] = []
  let currentChunk: ReleaseCalendarTrackedItem[] = []
  let currentChunkUniqueCount = 0

  for (const group of orderedGroups) {
    if (currentChunkUniqueCount === RELEASE_CALENDAR_CHUNK_SIZE) {
      chunks.push(currentChunk)
      currentChunk = []
      currentChunkUniqueCount = 0
    }

    currentChunk.push(...group)
    currentChunkUniqueCount += 1
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk)
  }

  return chunks
}

function compareReleaseCalendarReleases(
  left: ReleaseCalendarRelease,
  right: ReleaseCalendarRelease,
): number {
  if (left.releaseDate !== right.releaseDate) {
    return left.releaseDate.localeCompare(right.releaseDate)
  }

  if (left.mediaType !== right.mediaType) {
    return left.mediaType.localeCompare(right.mediaType)
  }

  return left.id - right.id
}

function mergeReleaseCalendarRelease(
  existingRelease: ReleaseCalendarRelease,
  nextRelease: ReleaseCalendarRelease,
): ReleaseCalendarRelease {
  return {
    ...existingRelease,
    ...nextRelease,
    posterPath: nextRelease.posterPath ?? existingRelease.posterPath,
    backdropPath: nextRelease.backdropPath ?? existingRelease.backdropPath,
    releaseDate: nextRelease.releaseDate || existingRelease.releaseDate,
    nextEpisode: nextRelease.nextEpisode ?? existingRelease.nextEpisode,
    sourceLists:
      nextRelease.sourceLists.length > 0
        ? nextRelease.sourceLists
        : existingRelease.sourceLists,
  }
}

function mergeReleaseCalendarReleases({
  fallbackReleases,
  enrichedReleases,
}: {
  fallbackReleases: ReleaseCalendarRelease[]
  enrichedReleases: ReleaseCalendarRelease[]
}): ReleaseCalendarRelease[] {
  const releasesByKey = new Map<string, ReleaseCalendarRelease>()

  for (const release of fallbackReleases) {
    releasesByKey.set(release.uniqueKey, release)
  }

  for (const release of enrichedReleases) {
    const existingRelease = releasesByKey.get(release.uniqueKey)

    if (!existingRelease) {
      releasesByKey.set(release.uniqueKey, release)
      continue
    }

    releasesByKey.set(
      release.uniqueKey,
      mergeReleaseCalendarRelease(existingRelease, release),
    )
  }

  return [...releasesByKey.values()].sort(compareReleaseCalendarReleases)
}

function logReleaseCalendarChunkFailure(
  chunk: ReleaseCalendarTrackedItem[],
  error: unknown,
): void {
  if (process.env.NODE_ENV === "test") {
    return
  }

  const dedupedChunkItems = dedupeTrackedItems(chunk)
  const movieCount = dedupedChunkItems.filter(
    (item) => item.mediaType === "movie",
  ).length

  console.error("[ReleaseCalendar] Chunk enrichment failed", {
    chunkSize: dedupedChunkItems.length,
    movieCount,
    reason: error instanceof Error ? error.message : "Unknown error",
    tvCount: dedupedChunkItems.length - movieCount,
  })
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
  const trackedItemChunks = useMemo(
    () =>
      buildTrackedItemChunks({
        trackedItems,
        dedupedTrackedItems,
      }),
    [dedupedTrackedItems, trackedItems],
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
    queryFn: async () => {
      const chunkedResults = await mapWithConcurrencyLimit(
        trackedItemChunks,
        async (chunk) => {
          try {
            return await fetchReleaseCalendarReleases({
              items: chunk,
              region,
              todayKey,
            })
          } catch (error) {
            logReleaseCalendarChunkFailure(chunk, error)
            return []
          }
        },
        RELEASE_CALENDAR_FETCH_CONCURRENCY,
      )

      return mergeReleaseCalendarReleases({
        fallbackReleases,
        enrichedReleases: chunkedResults.flat(),
      })
    },
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
