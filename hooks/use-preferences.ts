"use client"

import { useAuth } from "@/context/auth-context"
import {
  clearPosterOverride as clearPosterOverrideInFirestore,
  setPosterOverride as setPosterOverrideInFirestore,
} from "@/lib/firebase/poster-overrides"
import { getFirebaseDb } from "@/lib/firebase/config"
import {
  DEFAULT_PREFERENCES,
  type HomeScreenListItem,
  type UserPreferences,
} from "@/lib/firebase/user"
import {
  getDefaultPreferencesCacheData,
  type PreferencesCacheData,
} from "@/lib/preferences-cache"
import {
  buildPosterOverrideKey,
  sanitizePosterOverrides,
  type PosterOverrideMediaType,
} from "@/lib/poster-overrides"
import { type SupportedRegionCode } from "@/lib/regions"
import { queryCacheProfiles } from "@/lib/react-query/query-options"
import {
  queryKeys,
  UNAUTHENTICATED_USER_ID,
} from "@/lib/react-query/query-keys"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { doc, setDoc } from "firebase/firestore"
import { useCallback, useMemo } from "react"

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
  setPosterOverride: (
    mediaType: PosterOverrideMediaType,
    mediaId: number,
    posterPath: string,
  ) => Promise<void>
  clearPosterOverride: (
    mediaType: PosterOverrideMediaType,
    mediaId: number,
  ) => Promise<void>
}

const DEFAULT_PREFERENCES_CACHE_DATA = getDefaultPreferencesCacheData()

function rollbackPreferencesCacheData(
  queryClient: ReturnType<typeof useQueryClient>,
  queryKey: ReturnType<typeof queryKeys.firestore.preferences>,
  previousData: PreferencesCacheData | undefined,
) {
  if (previousData === undefined) {
    queryClient.removeQueries({ queryKey, exact: true })
    return
  }

  queryClient.setQueryData(queryKey, previousData)
}

export function usePreferences(): UsePreferencesReturn {
  const { user, loading: authLoading } = useAuth()
  const queryClient = useQueryClient()
  const userId = user && !user.isAnonymous ? user.uid : null
  const preferencesQueryKey = useMemo(
    () => queryKeys.firestore.preferences(userId ?? UNAUTHENTICATED_USER_ID),
    [userId],
  )

  const { data } = useQuery({
    ...queryCacheProfiles.profile,
    queryKey: preferencesQueryKey,
    queryFn: async () => DEFAULT_PREFERENCES_CACHE_DATA,
    enabled: false,
    initialData: userId ? undefined : DEFAULT_PREFERENCES_CACHE_DATA,
  })

  const currentData = data ?? DEFAULT_PREFERENCES_CACHE_DATA
  const preferences = currentData.preferences
  const region = currentData.region
  const isLoading = authLoading || (!!userId && data === undefined)

  const updatePreference = useCallback(
    async <K extends keyof UserPreferences>(
      key: K,
      value: UserPreferences[K],
    ): Promise<void> => {
      if (!userId) {
        throw new Error("User must be logged in to update preferences")
      }

      const userDocRef = doc(getFirebaseDb(), "users", userId)
      const queryKey = queryKeys.firestore.preferences(userId)
      const previousData =
        queryClient.getQueryData<PreferencesCacheData>(queryKey)

      queryClient.setQueryData<PreferencesCacheData>(queryKey, (current) => ({
        ...(current ?? DEFAULT_PREFERENCES_CACHE_DATA),
        preferences: {
          ...(current?.preferences ?? DEFAULT_PREFERENCES),
          [key]: value,
        },
      }))

      try {
        await setDoc(
          userDocRef,
          { preferences: { [key]: value } },
          { merge: true },
        )
      } catch (error) {
        console.error("Error updating preference:", error)
        rollbackPreferencesCacheData(queryClient, queryKey, previousData)
        throw error
      }
    },
    [queryClient, userId],
  )

  const updateHomeScreenLists = useCallback(
    async (lists: HomeScreenListItem[]): Promise<void> => {
      if (!userId) {
        throw new Error("User must be logged in to update home screen lists")
      }

      const userDocRef = doc(getFirebaseDb(), "users", userId)
      const queryKey = queryKeys.firestore.preferences(userId)
      const previousData =
        queryClient.getQueryData<PreferencesCacheData>(queryKey)

      queryClient.setQueryData<PreferencesCacheData>(queryKey, (current) => ({
        ...(current ?? DEFAULT_PREFERENCES_CACHE_DATA),
        preferences: {
          ...(current?.preferences ?? DEFAULT_PREFERENCES),
          homeScreenLists: lists,
        },
      }))

      try {
        await setDoc(
          userDocRef,
          { preferences: { homeScreenLists: lists } },
          { merge: true },
        )
      } catch (error) {
        console.error("Error updating home screen lists:", error)
        rollbackPreferencesCacheData(queryClient, queryKey, previousData)
        throw error
      }
    },
    [queryClient, userId],
  )

  const updateRegion = useCallback(
    async (nextRegion: SupportedRegionCode): Promise<void> => {
      if (!userId) {
        throw new Error("User must be logged in to update region")
      }

      if (nextRegion === region) {
        return
      }

      const userDocRef = doc(getFirebaseDb(), "users", userId)
      const queryKey = queryKeys.firestore.preferences(userId)
      const previousData =
        queryClient.getQueryData<PreferencesCacheData>(queryKey)

      queryClient.setQueryData<PreferencesCacheData>(queryKey, (current) => ({
        ...(current ?? DEFAULT_PREFERENCES_CACHE_DATA),
        region: nextRegion,
      }))

      try {
        await setDoc(userDocRef, { region: nextRegion }, { merge: true })
      } catch (error) {
        console.error("Error updating region:", error)
        rollbackPreferencesCacheData(queryClient, queryKey, previousData)
        throw error
      }
    },
    [queryClient, region, userId],
  )

  const setPosterOverride = useCallback(
    async (
      mediaType: PosterOverrideMediaType,
      mediaId: number,
      posterPath: string,
    ): Promise<void> => {
      if (!userId) {
        throw new Error("User must be logged in to update poster overrides")
      }

      const key = buildPosterOverrideKey(mediaType, mediaId)
      const queryKey = queryKeys.firestore.preferences(userId)
      const previousData =
        queryClient.getQueryData<PreferencesCacheData>(queryKey)

      queryClient.setQueryData<PreferencesCacheData>(queryKey, (current) => {
        const currentPreferences = current?.preferences ?? DEFAULT_PREFERENCES
        const currentOverrides = sanitizePosterOverrides(
          currentPreferences.posterOverrides,
        )

        return {
          ...(current ?? DEFAULT_PREFERENCES_CACHE_DATA),
          preferences: {
            ...currentPreferences,
            posterOverrides: {
              ...currentOverrides,
              [key]: posterPath,
            },
          },
        }
      })

      try {
        await setPosterOverrideInFirestore(userId, mediaType, mediaId, posterPath)
      } catch (error) {
        console.error("Error updating poster override:", error)
        rollbackPreferencesCacheData(queryClient, queryKey, previousData)
        throw error
      }
    },
    [queryClient, userId],
  )

  const clearPosterOverride = useCallback(
    async (
      mediaType: PosterOverrideMediaType,
      mediaId: number,
    ): Promise<void> => {
      if (!userId) {
        throw new Error("User must be logged in to update poster overrides")
      }

      const key = buildPosterOverrideKey(mediaType, mediaId)
      const queryKey = queryKeys.firestore.preferences(userId)
      const previousData =
        queryClient.getQueryData<PreferencesCacheData>(queryKey)

      queryClient.setQueryData<PreferencesCacheData>(queryKey, (current) => {
        const currentPreferences = current?.preferences ?? DEFAULT_PREFERENCES
        const nextOverrides = {
          ...sanitizePosterOverrides(currentPreferences.posterOverrides),
        }
        delete nextOverrides[key]

        return {
          ...(current ?? DEFAULT_PREFERENCES_CACHE_DATA),
          preferences: {
            ...currentPreferences,
            posterOverrides: nextOverrides,
          },
        }
      })

      try {
        await clearPosterOverrideInFirestore(userId, mediaType, mediaId)
      } catch (error) {
        console.error("Error clearing poster override:", error)
        rollbackPreferencesCacheData(queryClient, queryKey, previousData)
        throw error
      }
    },
    [queryClient, userId],
  )

  return {
    preferences,
    region,
    isLoading,
    updatePreference,
    updateHomeScreenLists,
    updateRegion,
    setPosterOverride,
    clearPosterOverride,
  }
}
