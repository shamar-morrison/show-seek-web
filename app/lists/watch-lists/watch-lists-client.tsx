"use client"

import { ListsPageClient } from "@/components/lists-page-client"
import { useLists } from "@/hooks/use-lists"
import type { Genre } from "@/types/tmdb"
import { useSearchParams } from "next/navigation"
import { useEffect, useMemo, useState } from "react"

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

  // Update selected list when lists load or URL param changes
  // Prioritize URL param if provided and valid
  useEffect(() => {
    if (!loading && defaultLists.length > 0) {
      // Prioritize URL param if provided and valid
      if (listIdFromUrl && defaultLists.find((l) => l.id === listIdFromUrl)) {
        setSelectedListId(listIdFromUrl)
        return
      }
      // Fallback to first list if none selected or current selection invalid
      if (
        !selectedListId ||
        !defaultLists.find((l) => l.id === selectedListId)
      ) {
        setSelectedListId(defaultLists[0].id)
      }
    }
  }, [loading, defaultLists, selectedListId, listIdFromUrl])

  return (
    <ListsPageClient
      lists={defaultLists}
      loading={loading}
      error={error}
      noListsTitle="No watch lists"
      noListsMessage="Your watch lists will appear here"
      movieGenres={movieGenres}
      tvGenres={tvGenres}
      selectedListId={selectedListId}
      onListSelect={setSelectedListId}
    />
  )
}
