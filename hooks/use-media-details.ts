"use client"

import { queryCacheProfiles } from "@/lib/react-query/query-options"
import { queryKeys } from "@/lib/react-query/query-keys"
import type { TMDBMovieDetails, TMDBTVDetails } from "@/types/tmdb"
import { useQuery } from "@tanstack/react-query"

/**
 * Fetch media details from the API
 */
async function fetchMediaDetails(
  mediaType: "movie" | "tv",
  id: number,
): Promise<TMDBMovieDetails | TMDBTVDetails> {
  const response = await fetch(`/api/media/${id}?type=${mediaType}`)

  if (!response.ok) {
    throw new Error(`Failed to fetch media details: ${response.status}`)
  }

  return response.json()
}

/**
 * Hook for fetching and caching media details using React Query.
 * Uses `queryCacheProfiles.profile` (30-min staleTime, 24-hour gcTime).
 *
 * @param mediaType - "movie" or "tv"
 * @param id - TMDB media ID
 * @param options - Optional config, including `enabled` for lazy loading
 */
export function useMediaDetails(
  mediaType: "movie" | "tv",
  id: number,
  options?: { enabled?: boolean },
) {
  return useQuery({
    ...queryCacheProfiles.profile,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    queryKey: queryKeys.mediaDetails(mediaType, id),
    queryFn: () => fetchMediaDetails(mediaType, id),
    enabled: options?.enabled ?? true,
  })
}
