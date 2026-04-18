"use client"

import { useAuth } from "@/context/auth-context"
import { hasStoredListItem } from "@/lib/list-item-keys"
import { useMemo } from "react"
import { useLists } from "./use-lists"
import { usePreferences } from "./use-preferences"

interface MediaItem {
  id: number
  media_type?: "movie" | "tv" | "person" | string
  release_date?: string
  first_air_date?: string
}

interface ContentFilterOptions {
  applyHideWatchedContent?: boolean
  applyHideUnreleasedContent?: boolean
}

export const useContentFilter = <T extends MediaItem>(
  items: T[] | undefined,
  options: ContentFilterOptions = {},
): T[] => {
  const {
    applyHideWatchedContent = true,
    applyHideUnreleasedContent = false,
  } = options
  const { preferences } = usePreferences()
  const { lists } = useLists()
  const { premiumStatus, user } = useAuth()
  const canUsePremiumFilters = premiumStatus !== "free"

  return useMemo(() => {
    // 1. Safety checks
    if (!items || !items.length) return []
    if (!user) return items // Don't filter for guests

    let filteredItems = items

    if (applyHideUnreleasedContent && preferences.hideUnreleasedContent) {
      const now = new Date()
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`

      filteredItems = filteredItems.filter((item) => {
        if (item.media_type === "person") return true

        const dateToCheck =
          item.media_type === "movie"
            ? item.release_date
            : item.media_type === "tv"
              ? item.first_air_date
              : item.release_date || item.first_air_date

        if (!dateToCheck) return true
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateToCheck)) return true

        return dateToCheck <= today
      })
    }

    if (
      !applyHideWatchedContent ||
      !canUsePremiumFilters ||
      !preferences.hideWatchedContent
    ) {
      return filteredItems
    }

    // The "Already Watched" list is the source of truth
    const alreadyWatchedList = lists.find((list) => list.id === "already-watched")
    if (!alreadyWatchedList?.items) return filteredItems

    return filteredItems.filter((item) => {
      if (item.media_type === "person") return true
      if (item.media_type !== "movie" && item.media_type !== "tv") return true

      return !hasStoredListItem(
        alreadyWatchedList.items,
        item.media_type,
        item.id,
      )
    })
  }, [
    items,
    applyHideWatchedContent,
    applyHideUnreleasedContent,
    preferences.hideWatchedContent,
    preferences.hideUnreleasedContent,
    lists,
    user,
    canUsePremiumFilters,
  ])
}
