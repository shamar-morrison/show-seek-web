"use client"

import { ListsPageClient } from "@/components/lists-page-client"
import { useLists } from "@/hooks/use-lists"
import type { Genre } from "@/types/tmdb"
import { useMemo } from "react"

interface WatchListsClientProps {
  /** Movie genres for filter options */
  movieGenres?: Genre[]
  /** TV genres for filter options */
  tvGenres?: Genre[]
}

/**
 * Watch Lists Client Component
 * Displays user's default lists with tab navigation and search filtering
 */
export function WatchListsClient({
  movieGenres = [],
  tvGenres = [],
}: WatchListsClientProps) {
  const { lists, loading, error } = useLists()

  // Filter to only default lists (non-custom)
  const defaultLists = useMemo(() => lists.filter((l) => !l.isCustom), [lists])

  return (
    <ListsPageClient
      lists={defaultLists}
      loading={loading}
      error={error}
      noListsTitle="No watch lists"
      noListsMessage="Your watch lists will appear here"
      movieGenres={movieGenres}
      tvGenres={tvGenres}
    />
  )
}
