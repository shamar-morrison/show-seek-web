"use client"

import { fetchTraktReviews } from "@/app/actions"
import { queryCacheProfiles } from "@/lib/react-query/query-options"
import { traktQueryKeys } from "@/lib/react-query/query-keys"
import type { TraktComment } from "@/types/trakt"
import { useQuery } from "@tanstack/react-query"

export { traktQueryKeys }

/**
 * Hook to fetch Trakt reviews/comments
 * Used for lazy-loading the Trakt reviews section
 */
export function useTraktReviews(
  mediaId: number,
  mediaType: "movie" | "tv",
  enabled = true,
) {
  return useQuery({
    ...queryCacheProfiles.profile,
    queryKey: traktQueryKeys.reviews(mediaId, mediaType),
    queryFn: async (): Promise<TraktComment[]> => {
      const data = await fetchTraktReviews(mediaId, mediaType)
      return data || []
    },
    enabled,
  })
}
