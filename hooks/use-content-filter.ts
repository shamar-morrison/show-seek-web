"use client"

import { useAuth } from "@/context/auth-context"
import { useMemo } from "react"
import { useLists } from "./use-lists"
import { usePreferences } from "./use-preferences"

interface MediaItem {
  id: number
  [key: string]: any
}

export const useContentFilter = <T extends MediaItem>(
  items: T[] | undefined,
): T[] => {
  const { preferences } = usePreferences()
  const { lists } = useLists()
  const { user, isPremium } = useAuth()

  return useMemo(() => {
    // 1. Safety checks
    if (!items || !items.length) return []
    if (!user) return items // Don't filter for guests
    
    // Premium feature check
    if (!isPremium) return items

    // 2. Check preference
    if (!preferences.hideWatchedContent) return items

    // 3. Get Watched Data
    // The "Already Watched" list is the source of truth
    const alreadyWatchedList = lists.find((list) => list.id === "already-watched")

    // If list doesn't exist or has no items, return original
    if (!alreadyWatchedList?.items) return items

    // 4. Create Lookup Set (O(1))
    // 'items' in the list object is a map where keys are media IDs
    const watchedIds = new Set(Object.keys(alreadyWatchedList.items).map(Number))

    // 5. Filter
    return items.filter((item) => !watchedIds.has(item.id))
  }, [items, preferences.hideWatchedContent, lists, user])
}
