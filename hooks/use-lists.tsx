"use client"

import { useAuth } from "@/context/auth-context"
import { db } from "@/lib/firebase/config"
import {
  deleteList,
  renameList,
} from "@/lib/firebase/lists"
import { DEFAULT_LISTS, UserList } from "@/types/list"
import { collection, onSnapshot, Timestamp } from "firebase/firestore"
import { useCallback, useEffect, useMemo, useState } from "react"

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
 * Hook for subscribing to user's lists with real-time updates
 * Automatically includes default lists even if they don't exist in Firestore
 */
export function useLists() {
  const { user, loading: authLoading } = useAuth()
  const [firestoreLists, setFirestoreLists] = useState<UserList[]>([])
  const [subscribed, setSubscribed] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    // Early return for unauthenticated users - no subscription needed
    if (!user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFirestoreLists([])
      setSubscribed(false)
      setError(null)
      return
    }

    const listsRef = collection(db, "users", user.uid, "lists")

    const unsubscribe = onSnapshot(
      listsRef,
      (snapshot) => {
        const lists = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as UserList[]

        setFirestoreLists(lists)
        setSubscribed(true)
        setError(null)
      },
      (err) => {
        console.error("Error fetching lists:", err)
        setError(err)
        setSubscribed(true)
      },
    )

    return () => unsubscribe()
  }, [user])

  // Derive loading state: loading while auth is pending OR while waiting for subscription
  const loading = authLoading || (!!user && !subscribed)

  // Merge Firestore lists with default lists and sort appropriately
  const lists = useMemo(() => {
    const firestoreListMap = new Map(firestoreLists.map((l) => [l.id, l]))

    // Create merged list with defaults first
    const mergedLists: UserList[] = []

    // Add default lists in their defined order
    for (const defaultList of DEFAULT_LISTS) {
      const existingList = firestoreListMap.get(defaultList.id)

      if (existingList) {
        // Use Firestore data but ensure correct name from defaults
        mergedLists.push({
          ...existingList,
          name: defaultList.name,
          isCustom: false,
        })
      } else {
        // Create ephemeral empty list for missing defaults
        mergedLists.push({
          id: defaultList.id,
          name: defaultList.name,
          items: {},
          createdAt: 0, // Ephemeral, not persisted
          isCustom: false,
        })
      }
    }

    // Add custom lists sorted by createdAt
    const customLists = firestoreLists
      .filter((l) => l.isCustom)
      .sort(
        (a, b) =>
          normalizeTimestamp(a.createdAt) - normalizeTimestamp(b.createdAt),
      )

    mergedLists.push(...customLists)

    return mergedLists
  }, [firestoreLists])

  const removeList = useCallback(
    async (listId: string) => {
      if (!user) throw new Error("User must be logged in")
      await deleteList(user.uid, listId)
    },
    [user],
  )

  const updateList = useCallback(
    async (listId: string, newName: string) => {
      if (!user) throw new Error("User must be logged in")
      await renameList(user.uid, listId, newName)
    },
    [user],
  )

  return { lists, loading, error, removeList, updateList }
}
