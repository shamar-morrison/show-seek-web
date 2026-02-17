"use client"

import { useAuth } from "@/context/auth-context"
import { useListMutations } from "@/hooks/use-list-mutations"
import { fetchUserLists } from "@/lib/firebase/lists"
import { queryCacheProfiles } from "@/lib/react-query/query-options"
import {
  queryKeys,
  UNAUTHENTICATED_USER_ID,
} from "@/lib/react-query/query-keys"
import { DEFAULT_LISTS, UserList } from "@/types/list"
import { Timestamp } from "firebase/firestore"
import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"

/**
 * Normalize createdAt to milliseconds for sorting
 * Handles Firestore Timestamp objects and number values
 */
function normalizeTimestamp(value: number | Timestamp | undefined): number {
  if (!value) return 0
  if (value instanceof Timestamp) return value.toMillis()
  return Number(value) || 0
}

/**
 * Hook for reading user lists with React Query caching.
 * Automatically includes default lists even if they don't exist in Firestore.
 */
export function useLists() {
  const { user, loading: authLoading } = useAuth()
  const { deleteList, renameList } = useListMutations()

  const userId = user && !user.isAnonymous ? user.uid : null

  const {
    data: firestoreLists = [],
    isLoading,
    error,
  } = useQuery({
    ...queryCacheProfiles.status,
    queryKey: queryKeys.firestore.lists(userId ?? UNAUTHENTICATED_USER_ID),
    queryFn: async () => {
      if (!userId) return []
      return fetchUserLists(userId)
    },
    enabled: !!userId,
  })

  // Derive loading state: loading while auth is pending OR while query is pending for an authenticated user
  const loading = authLoading || (!!userId && isLoading)

  // Merge Firestore lists with default lists and sort appropriately
  const lists = useMemo(() => {
    const firestoreListMap = new Map(firestoreLists.map((l) => [l.id, l]))

    const mergedLists: UserList[] = []

    for (const defaultList of DEFAULT_LISTS) {
      const existingList = firestoreListMap.get(defaultList.id)

      if (existingList) {
        mergedLists.push({
          ...existingList,
          name: defaultList.name,
          isCustom: false,
        })
      } else {
        mergedLists.push({
          id: defaultList.id,
          name: defaultList.name,
          items: {},
          createdAt: 0,
          isCustom: false,
        })
      }
    }

    const customLists = firestoreLists
      .filter((l) => l.isCustom)
      .sort(
        (a, b) =>
          normalizeTimestamp(a.createdAt) - normalizeTimestamp(b.createdAt),
      )

    mergedLists.push(...customLists)

    return mergedLists
  }, [firestoreLists])

  const removeList = async (listId: string) => {
    if (!userId) throw new Error("User must be logged in")
    await deleteList(listId)
  }

  const updateList = async (listId: string, newName: string) => {
    if (!userId) throw new Error("User must be logged in")
    await renameList(listId, newName)
  }

  return { lists, loading, error: (error as Error | null) ?? null, removeList, updateList }
}
