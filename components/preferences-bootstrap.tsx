"use client"

import { useAuth } from "@/context/auth-context"
import { getFirebaseDb } from "@/lib/firebase/config"
import { type UserDocument } from "@/lib/firebase/user"
import {
  getDefaultPreferencesCacheData,
  mapPreferencesCacheData,
} from "@/lib/preferences-cache"
import { queryKeys } from "@/lib/react-query/query-keys"
import { useQueryClient } from "@tanstack/react-query"
import { doc, onSnapshot } from "firebase/firestore"
import { useEffect, useRef } from "react"

export function PreferencesBootstrap() {
  const { user, loading: authLoading } = useAuth()
  const queryClient = useQueryClient()
  const previousUserIdRef = useRef<string | null>(null)

  const userId = user && !user.isAnonymous ? user.uid : null

  useEffect(() => {
    if (authLoading) {
      return
    }

    const previousUserId = previousUserIdRef.current

    if (previousUserId && previousUserId !== userId) {
      queryClient.removeQueries({
        queryKey: queryKeys.firestore.preferences(previousUserId),
        exact: true,
      })
    }

    previousUserIdRef.current = userId

    if (!userId) {
      return
    }

    const userDocRef = doc(getFirebaseDb(), "users", userId)
    // Intentionally realtime: preference changes should sync across active views.
    const unsubscribe = onSnapshot(
      userDocRef,
      (snapshot) => {
        const userData = snapshot.exists()
          ? (snapshot.data() as UserDocument)
          : undefined

        queryClient.setQueryData(
          queryKeys.firestore.preferences(userId),
          mapPreferencesCacheData(userData),
        )
      },
      (error) => {
        console.error("Error listening to preferences:", error)

        const queryKey = queryKeys.firestore.preferences(userId)
        if (!queryClient.getQueryData(queryKey)) {
          queryClient.setQueryData(queryKey, getDefaultPreferencesCacheData())
        }
      },
    )

    return unsubscribe
  }, [authLoading, queryClient, userId])

  return null
}
