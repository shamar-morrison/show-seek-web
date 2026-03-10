"use client"

import { ListsPageClient } from "@/components/lists-page-client"
import { useLists } from "@/hooks/use-lists"
import type { Genre } from "@/types/tmdb"
import { useSearchParams } from "next/navigation"
import { useMemo, useState } from "react"

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
  const searchParams = useSearchParams()
  const listIdFromUrl = searchParams.get("listId")
  const [selectedListId, setSelectedListId] = useState<string>("")

  // Filter to only default lists (non-custom)
  const defaultLists = useMemo(() => lists.filter((l) => !l.isCustom), [lists])

  const effectiveSelectedListId = useMemo(() => {
    if (
      listIdFromUrl &&
      defaultLists.some((list) => list.id === listIdFromUrl)
    ) {
      return listIdFromUrl
    }

    if (
      selectedListId &&
      defaultLists.some((list) => list.id === selectedListId)
    ) {
      return selectedListId
    }

    return defaultLists[0]?.id ?? ""
  }, [defaultLists, listIdFromUrl, selectedListId])

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
