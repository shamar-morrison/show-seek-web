"use client"

import { fetchGenreMap } from "@/app/actions"
import { queryKeys } from "@/lib/react-query/query-keys"
import { useQuery } from "@tanstack/react-query"

/**
 * Merged movie + TV genre id-to-name map for stats top-genre labels.
 * Genres change rarely: client-cached 30 days (server force-cache is
 * indefinite). Shared fetch keys with discover/lists pages.
 */
export function useGenreMap() {
  return useQuery({
    queryKey: queryKeys.tmdb.genreMap(),
    queryFn: fetchGenreMap,
    staleTime: 30 * 24 * 60 * 60 * 1000,
    gcTime: 30 * 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  })
}
