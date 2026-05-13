"use client"

import { ListsPageClient } from "@/components/lists-page-client"
import { useUrlStateSync } from "@/hooks/use-url-state-sync"
import { useLists } from "@/hooks/use-lists"
import type { Genre } from "@/types/tmdb"
import { useEffect, useMemo } from "react"

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
  const defaultLists = useMemo(() => lists.filter((l) => !l.isCustom), [lists])
  const defaultListId = defaultLists[0]?.id ?? ""
  const [urlState, setUrlState] = useUrlStateSync<{ selectedListId: string }>({
    keys: ["listId"],
    parse: (params) => ({
      selectedListId: params.get("listId") ?? "",
    }),
    serialize: (state) => {
      const params = new URLSearchParams()

      if (state.selectedListId && state.selectedListId !== defaultListId) {
        params.set("listId", state.selectedListId)
      }

      return params
    },
  })

  const effectiveSelectedListId = useMemo(() => {
    if (
      urlState.selectedListId &&
      defaultLists.some((list) => list.id === urlState.selectedListId)
    ) {
      return urlState.selectedListId
    }

    return defaultListId
  }, [defaultListId, defaultLists, urlState.selectedListId])

  useEffect(() => {
    if (defaultLists.length === 0) {
      return
    }

    const normalizedSelectedListId =
      effectiveSelectedListId && effectiveSelectedListId !== defaultListId
        ? effectiveSelectedListId
        : ""

    if (urlState.selectedListId !== normalizedSelectedListId) {
      setUrlState({ selectedListId: normalizedSelectedListId })
    }
  }, [
    defaultListId,
    effectiveSelectedListId,
    setUrlState,
    urlState.selectedListId,
  ])

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
      onListSelect={(selectedListId) => setUrlState({ selectedListId })}
      showShuffleAction={true}
    />
  )
}
