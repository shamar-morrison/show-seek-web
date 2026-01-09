"use client"

import { useAuth } from "@/context/auth-context"
import { db } from "@/lib/firebase/config"
import {
  DEFAULT_PREFERENCES,
  HomeScreenListItem,
  UserDocument,
  UserPreferences,
} from "@/lib/firebase/user"
import { doc, onSnapshot, setDoc } from "firebase/firestore"
import { useCallback, useEffect, useState } from "react"

interface UsePreferencesReturn {
  preferences: UserPreferences
  isLoading: boolean
  updatePreference: <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K],
  ) => Promise<void>
  updateHomeScreenLists: (lists: HomeScreenListItem[]) => Promise<void>
}

export function usePreferences(): UsePreferencesReturn {
  const { user } = useAuth()
  const [preferences, setPreferences] =
    useState<UserPreferences>(DEFAULT_PREFERENCES)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setPreferences(DEFAULT_PREFERENCES)
      setIsLoading(false)
      return
    }

    const userDocRef = doc(db, "users", user.uid)
    const unsubscribe = onSnapshot(
      userDocRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const userData = snapshot.data() as UserDocument
          // Merge with defaults to ensure all fields are present
          setPreferences({
            ...DEFAULT_PREFERENCES,
            ...userData.preferences,
          })
        } else {
          setPreferences(DEFAULT_PREFERENCES)
        }
        setIsLoading(false)
      },
      (error) => {
        console.error("Error listening to preferences:", error)
        setPreferences(DEFAULT_PREFERENCES)
        setIsLoading(false)
      },
    )

    return unsubscribe
  }, [user])

  const updatePreference = useCallback(
    async <K extends keyof UserPreferences>(
      key: K,
      value: UserPreferences[K],
    ): Promise<void> => {
      if (!user) {
        throw new Error("User must be logged in to update preferences")
      }

      const userDocRef = doc(db, "users", user.uid)

      // Capture original value before optimistic update
      let originalValue: UserPreferences[K]
      setPreferences((prev) => {
        originalValue = prev[key]
        return { ...prev, [key]: value }
      })

      try {
        await setDoc(
          userDocRef,
          { preferences: { [key]: value } },
          { merge: true },
        )
      } catch (error) {
        // Revert to original value on error
        console.error("Error updating preference:", error)
        setPreferences((prev) => ({ ...prev, [key]: originalValue }))
        throw error
      }
    },
    [user],
  )

  const updateHomeScreenLists = useCallback(
    async (lists: HomeScreenListItem[]): Promise<void> => {
      if (!user) {
        throw new Error("User must be logged in to update home screen lists")
      }

      const userDocRef = doc(db, "users", user.uid)

      // Capture original value before optimistic update
      let originalLists: HomeScreenListItem[] | undefined
      setPreferences((prev) => {
        originalLists = prev.homeScreenLists
        return { ...prev, homeScreenLists: lists }
      })

      try {
        await setDoc(
          userDocRef,
          { preferences: { homeScreenLists: lists } },
          { merge: true },
        )
      } catch (error) {
        // Revert to original value on error
        console.error("Error updating home screen lists:", error)
        setPreferences((prev) => ({ ...prev, homeScreenLists: originalLists }))
        throw error
      }
    },
    [user],
  )

  return { preferences, isLoading, updatePreference, updateHomeScreenLists }
}
