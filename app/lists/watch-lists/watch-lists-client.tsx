"use client"

import { ListsPageClient } from "@/components/lists-page-client"
import { useLists } from "@/hooks/use-lists"
import type { Genre } from "@/types/tmdb"
import { useMemo, useState } from "react"

interface WatchListsClientProps {
  /** Movie genres for filter options */
  movieGenres?: Genre[]
  /** TV genres for filter options */
  tvGenres?: Genre[]
  /** Optional list ID parsed from the URL on the server */
  initialListId?: string
}

/**
 * Watch Lists Client Component
 * Displays user's default lists with tab navigation and search filtering
 */
export function WatchListsClient({
  movieGenres = [],
  tvGenres = [],
  initialListId,
}: WatchListsClientProps) {
  const { lists, loading, error } = useLists()
  const [selectedListId, setSelectedListId] = useState<string>("")

  // Filter to only default lists (non-custom)
  const defaultLists = useMemo(() => lists.filter((l) => !l.isCustom), [lists])
  const urlSelectedListId = initialListId?.trim() || null

  const effectiveSelectedListId = useMemo(() => {
    if (
      urlSelectedListId &&
      defaultLists.some((list) => list.id === urlSelectedListId)
    ) {
      return urlSelectedListId
    }

    if (
      selectedListId &&
      defaultLists.some((list) => list.id === selectedListId)
    ) {
      return selectedListId
    }

    return defaultLists[0]?.id ?? ""
  }, [defaultLists, selectedListId, urlSelectedListId])

  return (
    <ListsPageClient
      lists={defaultLists}
      loading={loading}
      error={error}
      noListsTitle="No watch lists"
      noListsMessage="Your watch lists will appear here"
      movieGenres={movieGenres}
      tvGenres={tvGenres}
      selectedListId={effectiveSelectedListId}
      onListSelect={setSelectedListId}
    />
  )
}
