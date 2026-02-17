"use client"

import { useAuth } from "@/context/auth-context"
import { queryCacheProfiles } from "@/lib/react-query/query-options"
import {
  queryKeys,
  UNAUTHENTICATED_USER_ID,
} from "@/lib/react-query/query-keys"
import { episodeTrackingService } from "@/services/episode-tracking-service"
import type { TVShowEpisodeTracking } from "@/types/episode-tracking"
import { useQuery } from "@tanstack/react-query"

export function useEpisodeTrackingShow(tvShowId: number, enabled = true) {
  const { user, loading: authLoading } = useAuth()

  const userId = user && !user.isAnonymous ? user.uid : null
  const showQueryKey = userId
    ? queryKeys.firestore.episodeTrackingShow(userId, tvShowId)
    : null

  const { data, isLoading, error } = useQuery({
    ...queryCacheProfiles.status,
    queryKey: queryKeys.firestore.episodeTrackingShow(
      userId ?? UNAUTHENTICATED_USER_ID,
      tvShowId,
    ),
    queryFn: async (): Promise<TVShowEpisodeTracking | null> => {
      if (!userId) return null
      return episodeTrackingService.fetchShowTracking(tvShowId, userId)
    },
    enabled: enabled && !!userId,
  })

  return {
    tracking: data ?? null,
    loading: authLoading || (enabled && !!userId && isLoading),
    error: (error as Error | null) ?? null,
  }
}
