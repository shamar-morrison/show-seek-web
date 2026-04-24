"use client"

import { useAuth } from "@/context/auth-context"
import { queryKeys } from "@/lib/react-query/query-keys"
import { resetTraktManagedEditWarnings } from "@/lib/trakt-managed-edits"
import * as TraktService from "@/services/trakt-service"
import { TraktRequestError } from "@/services/trakt-service"
import type { SyncStatus, TraktContextValue } from "@/types/trakt"
import { useQueryClient } from "@tanstack/react-query"
import type { User } from "firebase/auth"
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"

const AUTO_SYNC_COOLDOWN_MS = 24 * 60 * 60 * 1000
const POLL_INTERVAL_MS = 3000
const STORAGE_KEY_PREFIX = "showseek_trakt_state_v1"

type PersistedTraktState = {
  connected: boolean
  lastEnrichedAt: string | null
  lastSyncedAt: string | null
  syncStatus: SyncStatus | null
}

const TraktContext = createContext<TraktContextValue | undefined>(undefined)

function isEligibleTraktUser(user: User | null): user is User {
  return Boolean(user && !user.isAnonymous)
}

function isActiveSyncStatus(status?: SyncStatus["status"]): boolean {
  return (
    status === "queued" || status === "in_progress" || status === "retrying"
  )
}

function isActiveEnrichmentStatus(
  status?:
    | "idle"
    | "queued"
    | "in_progress"
    | "retrying"
    | "completed"
    | "failed",
): boolean {
  return (
    status === "queued" || status === "in_progress" || status === "retrying"
  )
}

function isLockedAccountStatus(status?: SyncStatus | null): boolean {
  return (
    status?.status === "failed" && status.errorCategory === "locked_account"
  )
}

function getStorageKey(userId: string): string {
  return `${STORAGE_KEY_PREFIX}_${userId}`
}

function dateFromString(value?: string | null): Date | null {
  if (!value) return null

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function readPersistedState(userId: string): PersistedTraktState | null {
  if (typeof window === "undefined") return null

  try {
    const rawState = window.localStorage.getItem(getStorageKey(userId))
    if (!rawState) return null
    return JSON.parse(rawState) as PersistedTraktState
  } catch (error) {
    console.error("[Trakt] Failed to read persisted state:", error)
    return null
  }
}

function writePersistedState(userId: string, state: PersistedTraktState): void {
  if (typeof window === "undefined") return

  try {
    window.localStorage.setItem(getStorageKey(userId), JSON.stringify(state))
  } catch (error) {
    console.error("[Trakt] Failed to persist state:", error)
  }
}

function clearPersistedState(userId: string): void {
  if (typeof window === "undefined") return

  try {
    window.localStorage.removeItem(getStorageKey(userId))
  } catch {
    // No-op when localStorage is unavailable.
  }
}

export function TraktProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const queryClient = useQueryClient()
  const [isConnected, setIsConnected] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isEnriching, setIsEnriching] = useState(false)
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null)
  const [lastEnrichedAt, setLastEnrichedAt] = useState<Date | null>(null)
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const enrichmentIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  )
  const hasAttemptedAutoSyncRef = useRef(false)
  const latestSyncRequestRef = useRef<symbol | null>(null)
  const previousUserIdRef = useRef<string | null>(null)
  const lastEnrichedAtRef = useRef<Date | null>(null)

  const stopSyncPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }
  }, [])

  const stopEnrichmentPolling = useCallback(() => {
    if (enrichmentIntervalRef.current) {
      clearInterval(enrichmentIntervalRef.current)
      enrichmentIntervalRef.current = null
    }
  }, [])

  const invalidateImportedData = useCallback(
    (userId: string) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.firestore.lists(userId),
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.firestore.ratings(userId),
      })
      void queryClient.invalidateQueries({
        queryKey: ["firestore", "episode-tracking", userId],
      })
    },
    [queryClient],
  )

  const persistCurrentState = useCallback(
    ({
      connected,
      lastEnriched,
      lastSynced,
      status,
      userId,
    }: {
      connected: boolean
      lastEnriched: Date | null
      lastSynced: Date | null
      status: SyncStatus | null
      userId: string
    }) => {
      writePersistedState(userId, {
        connected,
        lastEnrichedAt: lastEnriched?.toISOString() ?? null,
        lastSyncedAt: lastSynced?.toISOString() ?? null,
        syncStatus: status,
      })
    },
    [],
  )

  const applySyncStatus = useCallback(
    (status: SyncStatus, userId: string) => {
      const syncDate = dateFromString(status.lastSyncedAt)

      setSyncStatus(status)
      setIsConnected(status.connected)
      setIsSyncing(isActiveSyncStatus(status.status))
      setLastSyncedAt(syncDate)

      persistCurrentState({
        connected: status.connected,
        lastEnriched: lastEnrichedAtRef.current,
        lastSynced: syncDate,
        status,
        userId,
      })
    },
    [persistCurrentState],
  )

  const checkSyncStatus = useCallback(async () => {
    if (!isEligibleTraktUser(user)) return undefined

    const status = await TraktService.checkSyncStatus()
    applySyncStatus(status, user.uid)
    return status
  }, [applySyncStatus, user])

  const pollEnrichmentStatus = useCallback(async () => {
    if (!isEligibleTraktUser(user)) return

    try {
      const status = await TraktService.checkEnrichmentStatus()
      const enrichmentActive = isActiveEnrichmentStatus(status.status)
      setIsEnriching(enrichmentActive)

      if (enrichmentActive) {
        return
      }

      stopEnrichmentPolling()

      if (status.status === "completed") {
        const enrichedDate = dateFromString(status.completedAt) ?? new Date()
        lastEnrichedAtRef.current = enrichedDate
        setLastEnrichedAt(enrichedDate)
        persistCurrentState({
          connected: isConnected,
          lastEnriched: enrichedDate,
          lastSynced: lastSyncedAt,
          status: syncStatus,
          userId: user.uid,
        })
        invalidateImportedData(user.uid)
      }
    } catch (error) {
      console.error("[Trakt] Failed to poll enrichment status:", error)
    }
  }, [
    invalidateImportedData,
    isConnected,
    lastSyncedAt,
    persistCurrentState,
    stopEnrichmentPolling,
    syncStatus,
    user,
  ])

  const pollSyncStatus = useCallback(async () => {
    if (!isEligibleTraktUser(user)) return

    try {
      const status = await TraktService.checkSyncStatus()
      applySyncStatus(status, user.uid)

      if (status.status !== "completed" && status.status !== "failed") {
        return
      }

      stopSyncPolling()
      setIsSyncing(false)

      if (status.status === "completed") {
        invalidateImportedData(user.uid)

        try {
          const enrichmentStatus = await TraktService.checkEnrichmentStatus()
          const enrichmentActive = isActiveEnrichmentStatus(
            enrichmentStatus.status,
          )
          setIsEnriching(enrichmentActive)

          if (enrichmentActive && !enrichmentIntervalRef.current) {
            enrichmentIntervalRef.current = setInterval(
              pollEnrichmentStatus,
              POLL_INTERVAL_MS,
            )
          } else if (
            enrichmentStatus.status === "completed" &&
            enrichmentStatus.completedAt
          ) {
            const enrichedDate = new Date(enrichmentStatus.completedAt)
            lastEnrichedAtRef.current = enrichedDate
            setLastEnrichedAt(enrichedDate)
            persistCurrentState({
              connected: true,
              lastEnriched: enrichedDate,
              lastSynced: dateFromString(status.lastSyncedAt),
              status,
              userId: user.uid,
            })
          }
        } catch (enrichmentError) {
          console.warn(
            "[Trakt] Failed to fetch enrichment status after sync:",
            enrichmentError,
          )
        }
      }
    } catch (error) {
      console.error("[Trakt] Failed to poll sync status:", error)
    }
  }, [
    applySyncStatus,
    invalidateImportedData,
    persistCurrentState,
    pollEnrichmentStatus,
    stopSyncPolling,
    user,
  ])

  useEffect(() => {
    if (authLoading) {
      setIsLoading(true)
      return
    }

    if (!isEligibleTraktUser(user)) {
      resetTraktManagedEditWarnings()
      stopSyncPolling()
      stopEnrichmentPolling()
      setIsConnected(false)
      setIsSyncing(false)
      setIsEnriching(false)
      setLastSyncedAt(null)
      lastEnrichedAtRef.current = null
      setLastEnrichedAt(null)
      setSyncStatus(null)
      setIsLoading(false)
      previousUserIdRef.current = null
      hasAttemptedAutoSyncRef.current = false
      return
    }

    if (previousUserIdRef.current !== user.uid) {
      resetTraktManagedEditWarnings()
      hasAttemptedAutoSyncRef.current = false
      previousUserIdRef.current = user.uid
    }

    let cancelled = false
    const controller = new AbortController()
    const requestToken = Symbol("sync-status-request")
    latestSyncRequestRef.current = requestToken
    setIsLoading(true)

    const persistedState = readPersistedState(user.uid)
    if (persistedState && !cancelled) {
      const persistedLastEnrichedAt = dateFromString(
        persistedState.lastEnrichedAt,
      )
      setIsConnected(persistedState.connected)
      setLastSyncedAt(dateFromString(persistedState.lastSyncedAt))
      lastEnrichedAtRef.current = persistedLastEnrichedAt
      setLastEnrichedAt(persistedLastEnrichedAt)
      setSyncStatus(persistedState.syncStatus)
      setIsSyncing(isActiveSyncStatus(persistedState.syncStatus?.status))
    }

    void TraktService.checkSyncStatus({ signal: controller.signal })
      .then((status) => {
        if (cancelled || latestSyncRequestRef.current !== requestToken) return
        applySyncStatus(status, user.uid)
      })
      .catch((error) => {
        if (
          !cancelled &&
          !controller.signal.aborted &&
          latestSyncRequestRef.current === requestToken
        ) {
          console.error("[Trakt] Failed to load status:", error)
        }
      })
      .finally(() => {
        if (!cancelled && latestSyncRequestRef.current === requestToken) {
          setIsLoading(false)
        }
      })

    return () => {
      cancelled = true
      controller.abort()
      if (latestSyncRequestRef.current === requestToken) {
        latestSyncRequestRef.current = null
      }
    }
  }, [
    applySyncStatus,
    authLoading,
    stopEnrichmentPolling,
    stopSyncPolling,
    user,
  ])

  useEffect(() => {
    return () => {
      stopSyncPolling()
      stopEnrichmentPolling()
    }
  }, [stopEnrichmentPolling, stopSyncPolling])

  useEffect(() => {
    if (!isEligibleTraktUser(user) || !syncStatus?.status) {
      stopSyncPolling()
      setIsSyncing(false)
      return
    }

    if (isActiveSyncStatus(syncStatus.status)) {
      setIsSyncing(true)

      if (!pollIntervalRef.current) {
        pollIntervalRef.current = setInterval(pollSyncStatus, POLL_INTERVAL_MS)
      }
      return
    }

    setIsSyncing(false)
  }, [pollSyncStatus, stopSyncPolling, syncStatus?.status, user])

  const connectTrakt = useCallback(async () => {
    if (!isEligibleTraktUser(user)) {
      throw new Error("Must be logged in to connect Trakt")
    }

    const status = await TraktService.initiateOAuthFlow()
    applySyncStatus(status, user.uid)
  }, [applySyncStatus, user])

  const syncNow = useCallback(async () => {
    if (!isEligibleTraktUser(user)) {
      throw new Error("Must be logged in to sync")
    }

    if (isSyncing) return

    setIsSyncing(true)
    setSyncStatus((currentStatus) => ({
      ...(currentStatus ?? {}),
      connected: true,
      synced: Boolean(currentStatus?.lastSyncedAt),
      attempt: 0,
      diagnostics: undefined,
      errorCategory: undefined,
      errorMessage: undefined,
      errors: undefined,
      nextAllowedSyncAt: undefined,
      nextRetryAt: undefined,
      status: "queued",
    }))

    try {
      await TraktService.triggerSync()
      await pollSyncStatus()

      if (!pollIntervalRef.current) {
        pollIntervalRef.current = setInterval(pollSyncStatus, POLL_INTERVAL_MS)
      }
    } catch (error) {
      setIsSyncing(false)

      if (
        error instanceof TraktRequestError &&
        error.category === "rate_limited"
      ) {
        setSyncStatus((currentStatus) => ({
          ...(currentStatus ?? {}),
          connected: true,
          synced: Boolean(currentStatus?.lastSyncedAt),
          errorCategory: "rate_limited",
          errorMessage: error.message,
          nextAllowedSyncAt: error.nextAllowedSyncAt,
          status: "failed",
        }))
      }

      throw error
    }
  }, [isSyncing, pollSyncStatus, user])

  useEffect(() => {
    if (
      !isEligibleTraktUser(user) ||
      !isConnected ||
      isLoading ||
      hasAttemptedAutoSyncRef.current ||
      !lastSyncedAt ||
      isLockedAccountStatus(syncStatus) ||
      isActiveSyncStatus(syncStatus?.status)
    ) {
      return
    }

    if (Date.now() - lastSyncedAt.getTime() >= AUTO_SYNC_COOLDOWN_MS) {
      hasAttemptedAutoSyncRef.current = true
      void syncNow()
    }
  }, [isConnected, isLoading, lastSyncedAt, syncNow, syncStatus, user])

  const disconnectTrakt = useCallback(async () => {
    if (!isEligibleTraktUser(user)) {
      throw new Error("Must be logged in to disconnect")
    }

    await TraktService.disconnectTrakt()
    resetTraktManagedEditWarnings()
    stopSyncPolling()
    stopEnrichmentPolling()
    setIsConnected(false)
    setIsSyncing(false)
    setIsEnriching(false)
    setLastSyncedAt(null)
    lastEnrichedAtRef.current = null
    setLastEnrichedAt(null)
    setSyncStatus(null)
    clearPersistedState(user.uid)
    invalidateImportedData(user.uid)
  }, [invalidateImportedData, stopEnrichmentPolling, stopSyncPolling, user])

  const enrichData = useCallback(async () => {
    if (!isEligibleTraktUser(user)) {
      throw new Error("Must be logged in to enrich data")
    }

    if (isEnriching) return

    setIsEnriching(true)

    try {
      await TraktService.triggerEnrichment({
        includeEpisodes: true,
      })

      if (!enrichmentIntervalRef.current) {
        enrichmentIntervalRef.current = setInterval(
          pollEnrichmentStatus,
          POLL_INTERVAL_MS,
        )
      }
    } catch (error) {
      setIsEnriching(false)
      throw error
    }
  }, [isEnriching, pollEnrichmentStatus, user])

  return (
    <TraktContext.Provider
      value={{
        isConnected,
        isSyncing,
        isEnriching,
        lastSyncedAt,
        lastEnrichedAt,
        syncStatus,
        isLoading,
        connectTrakt,
        disconnectTrakt,
        syncNow,
        checkSyncStatus,
        enrichData,
      }}
    >
      {children}
    </TraktContext.Provider>
  )
}

export function useTrakt() {
  const context = useContext(TraktContext)

  if (!context) {
    throw new Error("useTrakt must be used within TraktProvider")
  }

  return context
}

export function useOptionalTrakt() {
  return useContext(TraktContext)
}
