"use client"

import { backfillWatchTimeRuntimes } from "@/lib/watch-time-backfill"
import { queryKeys } from "@/lib/react-query/query-keys"
import type {
  WatchTimeEpisodeRef,
  WatchTimeListRef,
} from "@/hooks/use-watch-time-stats"
import { useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef } from "react"

interface UseWatchTimeBackfillOptions {
  userId: string | null
  unstampedEpisodes: WatchTimeEpisodeRef[]
  unstampedListItems: WatchTimeListRef[]
  /** True while the underlying caches are still loading. */
  loading: boolean
  /** Gate: only fire when the stats surface mounts (never eager). */
  enabled: boolean
}

/**
 * Fire the watch-time runtime backfill once per mount when the stats surface
 * loads with unstamped entries. On settle with stamps, invalidate only the
 * exact query keys the backfill writes (episode tracking + lists) — never a
 * broad prefix, and never ratings (untouched by backfill).
 */
export function useWatchTimeBackfill({
  userId,
  unstampedEpisodes,
  unstampedListItems,
  loading,
  enabled,
}: UseWatchTimeBackfillOptions): void {
  const queryClient = useQueryClient()
  const didRunRef = useRef(false)

  useEffect(() => {
    if (!enabled || loading || !userId || didRunRef.current) return
    if (unstampedEpisodes.length === 0 && unstampedListItems.length === 0) {
      return
    }

    didRunRef.current = true
    backfillWatchTimeRuntimes({
      userId,
      unstampedEpisodes,
      unstampedListItems,
      onStampsSettled: (didStamp) => {
        if (!didStamp) return
        void queryClient.invalidateQueries({
          queryKey: queryKeys.firestore.episodeTrackingAll(userId),
        })
        void queryClient.invalidateQueries({
          queryKey: queryKeys.firestore.lists(userId),
        })
      },
    })
  }, [
    enabled,
    loading,
    queryClient,
    userId,
    unstampedEpisodes,
    unstampedListItems,
  ])
}
