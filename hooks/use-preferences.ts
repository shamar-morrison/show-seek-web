"use client"

import { useAuth } from "@/context/auth-context"
import { db } from "@/lib/firebase/config"
import {
  DEFAULT_PREFERENCES,
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

      // Optimistic update
      setPreferences((prev) => ({ ...prev, [key]: value }))

      try {
        await setDoc(
          userDocRef,
          { preferences: { [key]: value } },
          { merge: true },
        )
      } catch (error) {
        // Revert on error
        console.error("Error updating preference:", error)
        setPreferences((prev) => ({ ...prev, [key]: !value }))
        throw error
      }
    },
    [user],
  )

  return { preferences, isLoading, updatePreference }
}
