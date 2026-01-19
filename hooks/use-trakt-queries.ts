"use client"

import { fetchTraktReviews } from "@/app/actions"
import type { TraktComment } from "@/types/trakt"
import { useQuery } from "@tanstack/react-query"

/**
 * Query keys for Trakt data
 * Centralized to ensure consistent cache key usage
 */
export const traktQueryKeys = {
  reviews: (mediaId: number, mediaType: "movie" | "tv") =>
    ["trakt", mediaType, mediaId, "reviews"] as const,
}

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
    queryKey: traktQueryKeys.reviews(mediaId, mediaType),
    queryFn: async (): Promise<TraktComment[]> => {
      const data = await fetchTraktReviews(mediaId, mediaType)
      return data || []
    },
    enabled,
  })
}
