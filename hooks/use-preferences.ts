"use client"

import { useAuth } from "@/context/auth-context"
import { getFirebaseDb } from "@/lib/firebase/config"
import { resolveUserRegion, type SupportedRegionCode } from "@/lib/regions"
import {
  DEFAULT_PREFERENCES,
  HomeScreenListItem,
  hydrateUserPreferences,
  UserDocument,
  UserPreferences,
} from "@/lib/firebase/user"
import { doc, onSnapshot, setDoc } from "firebase/firestore"
import { useCallback, useEffect, useState } from "react"

interface UsePreferencesReturn {
  preferences: UserPreferences
  region: SupportedRegionCode
  isLoading: boolean
  updatePreference: <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K],
  ) => Promise<void>
  updateHomeScreenLists: (lists: HomeScreenListItem[]) => Promise<void>
  updateRegion: (region: SupportedRegionCode) => Promise<void>
}

export function usePreferences(): UsePreferencesReturn {
  const { user, loading: authLoading } = useAuth()
  const [preferences, setPreferences] =
    useState<UserPreferences>(DEFAULT_PREFERENCES)
  const [region, setRegion] = useState<SupportedRegionCode>(
    resolveUserRegion(undefined),
  )
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return

    if (!user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPreferences(DEFAULT_PREFERENCES)
      setRegion(resolveUserRegion(undefined))
      setIsLoading(false)
      return
    }

    const userDocRef = doc(getFirebaseDb(), "users", user.uid)
    // Intentionally realtime: preference toggles should sync live across active views.
    const unsubscribe = onSnapshot(
      userDocRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const userData = snapshot.data() as UserDocument
          setPreferences(hydrateUserPreferences(userData.preferences))
          setRegion(resolveUserRegion(userData.region))
        } else {
          setPreferences(DEFAULT_PREFERENCES)
          setRegion(resolveUserRegion(undefined))
        }
        setIsLoading(false)
      },
      (error) => {
        console.error("Error listening to preferences:", error)
        setPreferences(DEFAULT_PREFERENCES)
        setRegion(resolveUserRegion(undefined))
        setIsLoading(false)
      },
    )

    return unsubscribe
  }, [user, authLoading])

  const updatePreference = useCallback(
    async <K extends keyof UserPreferences>(
      key: K,
      value: UserPreferences[K],
    ): Promise<void> => {
      if (!user) {
        throw new Error("User must be logged in to update preferences")
      }

      const userDocRef = doc(getFirebaseDb(), "users", user.uid)

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

      const userDocRef = doc(getFirebaseDb(), "users", user.uid)

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

  const updateRegion = useCallback(
    async (nextRegion: SupportedRegionCode): Promise<void> => {
      if (!user) {
        throw new Error("User must be logged in to update region")
      }

      if (nextRegion === region) {
        return
      }

      const userDocRef = doc(getFirebaseDb(), "users", user.uid)
      const previousRegion = region

      setRegion(nextRegion)

      try {
        await setDoc(userDocRef, { region: nextRegion }, { merge: true })
      } catch (error) {
        console.error("Error updating region:", error)
        setRegion(previousRegion)
        throw error
      }
    },
    [region, user],
  )

  return {
    preferences,
    region,
    isLoading,
    updatePreference,
    updateHomeScreenLists,
    updateRegion,
  }
}
