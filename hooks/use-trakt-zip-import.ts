"use client"

/**
 * Hook for managing Trakt zip archive import, upload progress, hold timeouts,
 * dismissal persistence, and real-time Firestore user-doc observation.
 *
 * Ported from mobile:
 *   src/context/trakt/useTraktZipImport.ts
 *   src/context/trakt/useTraktUserDocObserver.ts
 *   src/context/trakt/useTraktPersistence.ts
 *   src/context/trakt/constants.ts
 *   src/context/trakt/helpers.ts
 */

import { getFirebaseDb, isFirebaseClientConfigured } from "@/lib/firebase/config"
import * as TraktZipService from "@/services/trakt-zip-import-service"
import {
  TraktZipRateLimitedError,
  TraktZipUploadError,
} from "@/services/trakt-zip-import-service"
import type {
  SelectedZipFile,
  TraktZipImportProgressDoc,
  TraktZipImportUIState,
} from "@/types/trakt"
import type { User } from "firebase/auth"
import { doc, onSnapshot } from "firebase/firestore"
import { useCallback, useEffect, useRef, useState } from "react"
import { formatDistanceToNow } from "date-fns"

// --- Constants (ported verbatim from mobile constants.ts) ---

const ZIP_COOLDOWN_TICK_INTERVAL_MS = 15000

// Maximum time to wait for the progress doc after a terminal user-doc
// snapshot before falling back to the failed view. Healthy-case latency is
// sub-second (both docs are written in one transaction); this is deliberately
// generous to avoid false triggers on slow networks, and the state
// self-corrects if the doc arrives later.
const ZIP_HOLD_FOR_DOC_TIMEOUT_MS = 60000

const DISMISSED_ZIP_IMPORT_STORAGE_KEY = "showseek_dismissed_zip_import_id"

// --- Helpers (ported from mobile helpers.ts, adapted for localStorage) ---

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

function hasEligibleTraktUser(user: User | null): user is User {
  return Boolean(user && !user.isAnonymous)
}

function persistDismissedZipImportId(id: string | null): void {
  if (typeof window === "undefined") return

  try {
    if (id === null) {
      window.localStorage.removeItem(DISMISSED_ZIP_IMPORT_STORAGE_KEY)
    } else {
      window.localStorage.setItem(DISMISSED_ZIP_IMPORT_STORAGE_KEY, id)
    }
  } catch (error) {
    console.warn(
      "[Trakt] Failed to persist dismissed zip import id:",
      error,
    )
  }
}

function readDismissedZipImportId(): string | null {
  if (typeof window === "undefined") return null

  try {
    return window.localStorage.getItem(DISMISSED_ZIP_IMPORT_STORAGE_KEY)
  } catch {
    return null
  }
}

// --- Hook Options ---

export interface UseTraktZipImportOptions {
  user: User | null
  isSyncingRef: React.RefObject<boolean>
  invalidateImportedData: (userId: string) => void
}

// --- Hook Return Type ---

export interface TraktZipImportState {
  isZipImporting: boolean
  isZipImportRateLimited: boolean
  nextAllowedZipImportAt: Date | null
  zipImportUiState: TraktZipImportUIState
  zipUploadProgress: number
  zipImportDoc: TraktZipImportProgressDoc | null
  zipImportError: string | null
  selectedZipFile: SelectedZipFile | null
  startZipImport: (file: File) => Promise<void>
  dismissZipImport: () => void
  setSelectedZipFile: (file: SelectedZipFile | null) => void
}

// --- Main Hook ---

export function useTraktZipImport({
  user,
  isSyncingRef,
  invalidateImportedData,
}: UseTraktZipImportOptions): TraktZipImportState {
  // Read dismissed ID synchronously (no async hydration needed on web)
  const initialDismissedId = useRef(readDismissedZipImportId()).current

  const [zipImportUiState, setZipImportUiState] =
    useState<TraktZipImportUIState>("idle")
  const [selectedZipFile, setSelectedZipFile] =
    useState<SelectedZipFile | null>(null)
  const [zipUploadProgress, setZipUploadProgress] = useState(0)
  const [zipImportDoc, setZipImportDoc] =
    useState<TraktZipImportProgressDoc | null>(null)
  const [zipImportError, setZipImportError] = useState<string | null>(null)
  const [nextAllowedZipImportAt, setNextAllowedZipImportAt] =
    useState<Date | null>(null)
  const [, setZipCooldownTick] = useState(0)
  // Import id the user has explicitly dismissed via Done. Terminal server
  // statuses for this id are ignored so the summary can't resurrect (with
  // null stats) on later snapshots. Persisted so dismissal survives restarts.
  const [, setDismissedZipImportId] = useState<string | null>(
    initialDismissedId,
  )

  const activeZipImportSubscriptionRef = useRef<(() => void) | null>(null)
  const activeZipImportIdRef = useRef<string | null>(null)
  const dismissedZipImportIdRef = useRef<string | null>(initialDismissedId)
  const lastSeenZipImportIdRef = useRef<string | null>(null)
  const zipImportDocIdRef = useRef<string | null>(null)
  const zipImportDocRef = useRef<TraktZipImportProgressDoc | null>(null)
  const isZipImportingRef = useRef(false)

  // Hold-state timeout: fires if the progress doc never arrives after a
  // terminal user-doc snapshot. Keyed to the import id it was started for.
  const holdTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const holdTimeoutImportIdRef = useRef<string | null>(null)

  // Enrichment status tracking (from useTraktUserDocObserver)
  const prevEnrichmentStatusRef = useRef<string | undefined>(undefined)

  const clearZipHoldTimeout = useCallback(() => {
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current)
      holdTimeoutRef.current = null
    }
    holdTimeoutImportIdRef.current = null
  }, [])

  // Keep doc refs in sync without adding state deps to the snapshot observer.
  useEffect(() => {
    zipImportDocIdRef.current = zipImportDoc?.id ?? null
    zipImportDocRef.current = zipImportDoc
    // Progress doc arrived: no longer holding for it.
    if (zipImportDoc && holdTimeoutImportIdRef.current === zipImportDoc.id) {
      clearZipHoldTimeout()
    }
  }, [zipImportDoc, clearZipHoldTimeout])

  const isZipImporting =
    zipImportUiState === "uploading" || zipImportUiState === "processing"
  useEffect(() => {
    isZipImportingRef.current = isZipImporting
  }, [isZipImporting])

  const isZipImportRateLimited =
    nextAllowedZipImportAt !== null &&
    nextAllowedZipImportAt.getTime() > Date.now()

  // Cooldown tick interval — identical logic from mobile
  useEffect(() => {
    if (
      !nextAllowedZipImportAt ||
      nextAllowedZipImportAt.getTime() <= Date.now()
    ) {
      return
    }

    const interval = setInterval(() => {
      setZipCooldownTick((tick) => tick + 1)
      if (nextAllowedZipImportAt.getTime() <= Date.now()) {
        clearInterval(interval)
      }
    }, ZIP_COOLDOWN_TICK_INTERVAL_MS)

    return () => {
      clearInterval(interval)
    }
  }, [nextAllowedZipImportAt])

  const invalidateUserLibraryQueries = useCallback(async () => {
    if (!user) return
    invalidateImportedData(user.uid)
  }, [invalidateImportedData, user])

  const subscribeToZipProgress = useCallback(
    (userId: string, importId: string) => {
      if (
        activeZipImportIdRef.current === importId &&
        activeZipImportSubscriptionRef.current
      ) {
        return
      }

      if (activeZipImportSubscriptionRef.current) {
        activeZipImportSubscriptionRef.current()
        activeZipImportSubscriptionRef.current = null
      }

      activeZipImportIdRef.current = importId

      const unsubscribe = TraktZipService.subscribeToProgress(
        userId,
        importId,
        (data) => {
          // A dismissed import's terminal state must never resurface via
          // this path, regardless of when hydration completes.
          if (data.id && data.id === dismissedZipImportIdRef.current) {
            return
          }
          setZipImportDoc(data)

          if (data.status === "completed") {
            setZipImportUiState("completed")
            void invalidateUserLibraryQueries()
          } else if (data.status === "failed") {
            setZipImportUiState("failed")
            setZipImportError(data.error || "Import failed.")
          } else if (
            data.status === "pending" ||
            data.status === "processing"
          ) {
            setZipImportUiState("processing")
          }
        },
        (subError) => {
          console.error(
            "[TraktContext] Progress subscription error:",
            subError,
          )
          setZipImportUiState("failed")
          setZipImportError(
            subError.message || "Failed to track import progress.",
          )
        },
      )

      activeZipImportSubscriptionRef.current = unsubscribe
    },
    [invalidateUserLibraryQueries],
  )

  /**
   * Handles a terminal (completed/failed) zip import status from the user
   * document. Never shows a terminal view without a matching non-null
   * progress doc: if the user-doc snapshot wins the race, hold at
   * processing and hydrate first. Shared 60s hold-timeout bounds the wait
   * for the genuinely-diverged case (progress doc never written).
   */
  const processTerminalZipSnapshot = useCallback(
    (params: {
      userId: string
      importId: string | null
      status: "completed" | "failed"
      error?: string
    }) => {
      const { userId, importId, status, error } = params

      if (importId && dismissedZipImportIdRef.current === importId) {
        return
      }

      const haveDocForSnapshot =
        !!importId &&
        zipImportDocIdRef.current === importId &&
        zipImportDocRef.current !== null
      if (haveDocForSnapshot) {
        clearZipHoldTimeout()
        if (status === "completed") {
          setZipImportUiState("completed")
          void invalidateUserLibraryQueries()
        } else {
          setZipImportUiState("failed")
          setZipImportError(error || "Import failed.")
        }
        return
      }

      // Terminal user-doc snapshot without a local progress doc (fresh
      // launch, in-flight race, or failed-path divergence): hold at
      // processing and hydrate instead of rendering zeros.
      if (importId) {
        setZipImportUiState("processing")
        subscribeToZipProgress(userId, importId)
        clearZipHoldTimeout()
        holdTimeoutImportIdRef.current = importId
        holdTimeoutRef.current = setTimeout(() => {
          // Re-verify still holding for the same import with no doc: a late
          // timer must never clobber a newer import's state.
          if (holdTimeoutImportIdRef.current !== importId) {
            return
          }
          if (zipImportDocRef.current?.id === importId) {
            return
          }
          holdTimeoutRef.current = null
          holdTimeoutImportIdRef.current = null
          setZipImportUiState("failed")
          setZipImportError(
            "Import status is unavailable. Please try again.",
          )
        }, ZIP_HOLD_FOR_DOC_TIMEOUT_MS)
      }
    },
    [clearZipHoldTimeout, invalidateUserLibraryQueries, subscribeToZipProgress],
  )

  const resetZipImportState = useCallback(() => {
    if (activeZipImportSubscriptionRef.current) {
      activeZipImportSubscriptionRef.current()
      activeZipImportSubscriptionRef.current = null
    }
    activeZipImportIdRef.current = null
    clearZipHoldTimeout()
    setZipImportUiState("idle")
    setSelectedZipFile(null)
    setZipUploadProgress(0)
    setZipImportDoc(null)
    setZipImportError(null)
    setNextAllowedZipImportAt(null)
    isZipImportingRef.current = false
  }, [clearZipHoldTimeout])

  // --- User Document Observer (from mobile useTraktUserDocObserver.ts) ---

  useEffect(() => {
    if (!isFirebaseClientConfigured || !hasEligibleTraktUser(user)) {
      resetZipImportState()
      prevEnrichmentStatusRef.current = undefined
      return
    }

    const userDocRef = doc(getFirebaseDb(), "users", user.uid)
    const unsubscribe = onSnapshot(
      userDocRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          return
        }

        const data = snapshot.data()

        // --- Enrichment status observer ---
        const enrichmentStatus = data?.traktEnrichmentStatus
        const currentStatus = enrichmentStatus?.status as
          | "idle"
          | "queued"
          | "in_progress"
          | "retrying"
          | "completed"
          | "failed"
          | undefined

        const prevStatus = prevEnrichmentStatusRef.current
        prevEnrichmentStatusRef.current = currentStatus

        if (currentStatus === "completed") {
          // If transitioning from an active state to completed, invalidate
          if (prevStatus && prevStatus !== "completed") {
            console.log(
              "[Trakt] Background enrichment completed. Invalidating library queries.",
            )
            invalidateImportedData(user.uid)
          }
        }

        // --- Zip import status observer ---
        const zipStatus = data?.traktZipImportStatus
        if (zipStatus) {
          const zipImportId: string | null =
            zipStatus.id ||
            (zipStatus as Record<string, unknown>).activeImportId ||
            null
          if (zipImportId) {
            lastSeenZipImportIdRef.current = zipImportId
          }
          const wasDismissed =
            !!zipImportId &&
            dismissedZipImportIdRef.current === zipImportId
          const isZipActive =
            zipStatus.status === "pending" ||
            zipStatus.status === "processing"
          if (isZipActive) {
            if (wasDismissed) {
              // Import became active again (e.g. retried server-side):
              // the previous dismissal no longer applies.
              dismissedZipImportIdRef.current = null
              setDismissedZipImportId(null)
              persistDismissedZipImportId(null)
            }
            // A hold timeout keyed to an older terminal snapshot must not
            // outlive the import becoming active again; the next terminal
            // snapshot re-arms the wait if needed.
            clearZipHoldTimeout()
            setZipImportUiState("processing")
            if (zipImportId) {
              subscribeToZipProgress(user.uid, zipImportId)
            }
          } else if (zipStatus.status === "completed") {
            processTerminalZipSnapshot({
              userId: user.uid,
              importId: zipImportId,
              status: "completed",
            })
          } else if (zipStatus.status === "failed") {
            processTerminalZipSnapshot({
              userId: user.uid,
              importId: zipImportId,
              status: "failed",
              error: zipStatus.error,
            })
          }

          const zipNextAllowedAt = zipStatus.nextAllowedImportAt
          let parsedSnapshotNextAllowedAt: Date | null = null
          if (
            zipNextAllowedAt &&
            typeof zipNextAllowedAt.toDate === "function"
          ) {
            const date = zipNextAllowedAt.toDate()
            if (
              date &&
              typeof date.getTime === "function" &&
              !isNaN(date.getTime())
            ) {
              parsedSnapshotNextAllowedAt = date
            }
          }
          setNextAllowedZipImportAt(parsedSnapshotNextAllowedAt)
        } else {
          setNextAllowedZipImportAt(null)
        }
      },
      (error) => {
        console.warn("[Trakt] Error observing user document:", error)
      },
    )

    return () => {
      unsubscribe()
      resetZipImportState()
      prevEnrichmentStatusRef.current = undefined
    }
  }, [
    user,
    invalidateImportedData,
    subscribeToZipProgress,
    processTerminalZipSnapshot,
    clearZipHoldTimeout,
    resetZipImportState,
  ])

  // --- Start Zip Import (from mobile useTraktZipImport.ts startZipImport) ---

  const startZipImport = useCallback(
    async (file: File) => {
      if (!hasEligibleTraktUser(user)) {
        throw new Error("Must be logged in to import Trakt archive")
      }

      if (isSyncingRef.current) {
        throw new Error("A Trakt sync is already in progress.")
      }

      if (isZipImporting || isZipImportingRef.current) {
        throw new Error("A Trakt zip import is already in progress.")
      }

      const selectedFile: SelectedZipFile = {
        file,
        name: file.name || "trakt-export.zip",
        size: file.size,
      }

      isZipImportingRef.current = true
      setSelectedZipFile(selectedFile)
      setZipImportUiState("uploading")
      setZipUploadProgress(0)
      setZipImportError(null)
      // A new import supersedes any previous dismissal.
      dismissedZipImportIdRef.current = null
      setDismissedZipImportId(null)
      persistDismissedZipImportId(null)

      const importId = TraktZipService.generateImportId()

      try {
        await TraktZipService.uploadZipFile(
          user.uid,
          importId,
          file,
          (progress) => {
            setZipUploadProgress(progress)
          },
        )

        setZipImportUiState("processing")
        subscribeToZipProgress(user.uid, importId)
        await TraktZipService.startImport(importId)
      } catch (error) {
        isZipImportingRef.current = false
        if (activeZipImportIdRef.current === importId) {
          if (activeZipImportSubscriptionRef.current) {
            activeZipImportSubscriptionRef.current()
            activeZipImportSubscriptionRef.current = null
          }
          activeZipImportIdRef.current = null
        }
        console.error("[TraktContext] Zip import error:", error)
        setZipImportUiState("failed")

        if (error instanceof TraktZipRateLimitedError) {
          let parsedNextAllowedAt: Date | null = null
          if (error.nextAllowedImportAt) {
            const parsed = new Date(error.nextAllowedImportAt)
            if (!isNaN(parsed.getTime())) {
              parsedNextAllowedAt = parsed
              setNextAllowedZipImportAt(parsed)
            } else {
              setNextAllowedZipImportAt(null)
            }
          }
          setZipImportError(
            parsedNextAllowedAt
              ? `Import cooldown active. You can start another import ${formatDistanceToNow(parsedNextAllowedAt, { addSuffix: true })}.`
              : "Please wait before starting another import.",
          )
        } else if (error instanceof TraktZipUploadError) {
          setZipImportError(
            "Upload failed: Network error while uploading archive.",
          )
        } else {
          setZipImportError(
            error instanceof Error ? error.message : "Import failed.",
          )
        }
        throw error
      }
    },
    [isZipImporting, isSyncingRef, subscribeToZipProgress, user],
  )

  // --- Dismiss Zip Import (from mobile useTraktZipImport.ts dismissZipImport) ---

  const dismissZipImport = useCallback(() => {
    isZipImportingRef.current = false
    if (activeZipImportSubscriptionRef.current) {
      activeZipImportSubscriptionRef.current()
      activeZipImportSubscriptionRef.current = null
    }
    // Remember which import was acknowledged so later user-doc snapshots
    // for the same (still-persisted server-side) terminal status can't
    // resurrect the summary with null stats.
    const dismissedId =
      activeZipImportIdRef.current ??
      zipImportDocIdRef.current ??
      lastSeenZipImportIdRef.current
    if (dismissedId) {
      dismissedZipImportIdRef.current = dismissedId
      setDismissedZipImportId(dismissedId)
      persistDismissedZipImportId(dismissedId)
    }
    activeZipImportIdRef.current = null
    clearZipHoldTimeout()
    setZipImportUiState("idle")
    setSelectedZipFile(null)
    setZipUploadProgress(0)
    setZipImportDoc(null)
    setZipImportError(null)
  }, [clearZipHoldTimeout])

  // Cleanup subscription on unmount
  useEffect(() => {
    return () => {
      if (activeZipImportSubscriptionRef.current) {
        activeZipImportSubscriptionRef.current()
        activeZipImportSubscriptionRef.current = null
      }
      clearZipHoldTimeout()
    }
  }, [clearZipHoldTimeout])

  return {
    isZipImporting,
    isZipImportRateLimited,
    nextAllowedZipImportAt,
    zipImportUiState,
    zipUploadProgress,
    zipImportDoc,
    zipImportError,
    selectedZipFile,
    startZipImport,
    dismissZipImport,
    setSelectedZipFile,
  }
}
