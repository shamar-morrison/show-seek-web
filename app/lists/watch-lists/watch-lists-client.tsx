"use client"

import { ListsPageClient } from "@/components/lists-page-client"
import { useLists } from "@/hooks/use-lists"
import { useMemo } from "react"

/**
 * Watch Lists Client Component
 * Displays user's default lists with tab navigation and search filtering
 */
export function WatchListsClient() {
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
    />
  )
}
