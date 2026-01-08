"use client"

import { ListsPageClient } from "@/components/lists-page-client"
import { useLists } from "@/hooks/use-lists"
import { FolderLibraryIcon } from "@hugeicons/core-free-icons"
import { useMemo } from "react"

/**
 * Custom Lists Client Component
 * Displays user's custom lists with tab navigation and search filtering
 */
export function CustomListsClient() {
  const { lists, loading, error } = useLists()

  // Filter to only custom lists
  const customLists = useMemo(() => lists.filter((l) => l.isCustom), [lists])

  return (
    <ListsPageClient
      lists={customLists}
      loading={loading}
      error={error}
      defaultIcon={FolderLibraryIcon}
      noListsTitle="No custom lists"
      noListsMessage="Create your first custom list to organize your favorites"
    />
  )
}
