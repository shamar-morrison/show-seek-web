"use client"

import { useEpisodeTracking } from "@/hooks/use-episode-tracking"
import { useLists } from "@/hooks/use-lists"
import { computeProfileWatchTime } from "@/lib/profile-watch-time"
import { useMemo } from "react"

/**
 * Total Hours Watched for the profile header.
 *
 * Read-only: derives the mobile-parity total from the existing
 * `useEpisodeTracking` + `useLists` React Query caches. Adds zero new
 * Firestore queries and performs zero writes (no stamping, no backfill).
 * Stale until the next refetch/navigation, by design.
 */
export function useProfileWatchTime() {
  const { tracking, loading: trackingLoading } = useEpisodeTracking()
  const { lists, loading: listsLoading } = useLists()

  const totalMinutes = useMemo(
    () => computeProfileWatchTime(tracking, lists),
    [tracking, lists],
  )

  return {
    totalMinutes,
    isLoading: trackingLoading || listsLoading,
  }
}
