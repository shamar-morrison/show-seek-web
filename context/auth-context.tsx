"use client"

import {
  getFirebaseAuth,
  getFirebaseClientConfigErrorMessage,
  getFirebaseDb,
  getFirebaseFunctions,
  isFirebaseClientConfigured,
} from "@/lib/firebase/config"
import {
  createServerSessionSyncManager,
  type ServerSessionSyncResult,
  type ServerSessionSyncSnapshot,
  syncServerSessionWithIdToken,
} from "@/lib/firebase/client-session"
import {
  createPremiumTelemetryPayload,
  trackPremiumEvent,
} from "@/lib/premium-telemetry"
import { type PremiumStatus as PremiumGateStatus } from "@/lib/premium-gating"
import type { UserDocument } from "@/lib/firebase/user"
import {
  User,
  onIdTokenChanged,
  signOut as firebaseSignOut,
} from "firebase/auth"
import { doc, onSnapshot } from "firebase/firestore"
import { httpsCallable } from "firebase/functions"
import { useRouter } from "next/navigation"
import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"

export type PremiumStatus = PremiumGateStatus
type ReconcileCallableName = "reconcilePremiumStatus" | "syncPremiumStatus"

const RECONCILE_CALLABLE_ORDER: readonly ReconcileCallableName[] = [
  "reconcilePremiumStatus",
  "syncPremiumStatus",
]

export type ReconcilePremiumStatusResponse = {
  isPremium: boolean
  source: "firestore" | "revenuecat" | "both" | "none"
  reconciledAt: string | null
}

interface AuthContextType {
  firebaseAvailable: boolean
  user: User | null
  loading: boolean
  isPremium: boolean
  premiumLastCheckedAt: string | null
  premiumLoading: boolean
  premiumStatus: PremiumStatus
  serverSessionSync: ServerSessionSyncSnapshot
  ensureServerSession: (
    candidateUser?: User | null,
  ) => Promise<ServerSessionSyncResult>
  markServerSessionReady: (
    candidateUser: User,
  ) => Promise<ServerSessionSyncResult>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const RECONCILE_ATTEMPT_KEY_PREFIX = "premium_reconcile_attempted_v2_"
const RECONCILE_DEPENDENCY_LOGGED_KEY_PREFIX =
  "premium_reconcile_dependency_logged_"
const RECONCILE_DEPENDENCY_ERROR_CODES = new Set([
  "functions/not-found",
  "functions/unimplemented",
  "functions/unavailable",
  "not-found",
  "unimplemented",
  "unavailable",
])
const RECONCILE_FALLBACK_ERROR_CODES = new Set([
  "functions/not-found",
  "functions/unimplemented",
  "not-found",
  "unimplemented",
])
const reconcileEnabled =
  process.env.NEXT_PUBLIC_ENABLE_PREMIUM_RECONCILE !== "false"

export const resolvePremiumStatusFromSnapshot = ({
  currentStatus,
  hasAttemptedReconcile,
  nextIsPremium,
}: {
  currentStatus: PremiumStatus
  hasAttemptedReconcile: boolean
  nextIsPremium: boolean
}): { nextStatus: PremiumStatus; preserveCurrent: boolean } => {
  if (nextIsPremium) {
    return { nextStatus: "premium", preserveCurrent: false }
  }

  if (currentStatus === "premium" && hasAttemptedReconcile) {
    return { nextStatus: currentStatus, preserveCurrent: true }
  }

  return { nextStatus: "free", preserveCurrent: false }
}

export const resolvePremiumStatusOnListenerError = ({
  currentStatus,
}: {
  currentStatus: PremiumStatus
}): PremiumStatus => (currentStatus === "unknown" ? "free" : currentStatus)

export const resolvePremiumStatusFromReconcileResult = ({
  isPremium,
}: {
  isPremium: boolean
}): PremiumStatus => (isPremium ? "premium" : "free")

export const shouldStartPremiumReconcile = ({
  hasAttemptedReconcile,
  nextIsPremium,
}: {
  hasAttemptedReconcile: boolean
  nextIsPremium: boolean
}): boolean => !nextIsPremium && !hasAttemptedReconcile

const getSessionMarker = (key: string): boolean => {
  if (typeof window === "undefined") {
    return false
  }

  try {
    return window.sessionStorage.getItem(key) === "1"
  } catch {
    return false
  }
}

const setSessionMarker = (key: string): void => {
  if (typeof window === "undefined") {
    return
  }

  try {
    window.sessionStorage.setItem(key, "1")
  } catch {
    // No-op when sessionStorage is unavailable.
  }
}

const getReconcileAttemptKey = (userId: string): string =>
  `${RECONCILE_ATTEMPT_KEY_PREFIX}${userId}`

const getReconcileDependencyLoggedKey = (userId: string): string =>
  `${RECONCILE_DEPENDENCY_LOGGED_KEY_PREFIX}${userId}`

const getReconcileErrorCode = (error: unknown): string => {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  ) {
    return (error as { code: string }).code
  }

  return "unknown"
}

const isReconcileDependencyError = (errorCode: string): boolean => {
  return RECONCILE_DEPENDENCY_ERROR_CODES.has(errorCode)
}

export const shouldFallbackToLegacyReconcileCallable = (
  errorCode: string,
): boolean => {
  return RECONCILE_FALLBACK_ERROR_CODES.has(errorCode)
}

const parseReconcilePremiumStatusResponse = (
  callableName: ReconcileCallableName,
  data: unknown,
): ReconcilePremiumStatusResponse => {
  if (!data || typeof data !== "object") {
    const error = new Error("Invalid reconcile response payload")
    ;(error as { code?: string }).code = "invalid-response"
    throw error
  }

  const candidate = data as Partial<ReconcilePremiumStatusResponse>
  const source = candidate.source

  if (
    callableName === "syncPremiumStatus" &&
    typeof candidate.isPremium === "boolean"
  ) {
    return {
      isPremium: candidate.isPremium,
      source:
        source === "firestore" ||
        source === "revenuecat" ||
        source === "both" ||
        source === "none"
          ? source
          : "firestore",
      reconciledAt:
        candidate.reconciledAt === null ||
        typeof candidate.reconciledAt === "string"
          ? candidate.reconciledAt
          : null,
    }
  }

  if (
    typeof candidate.isPremium !== "boolean" ||
    !(
      source === "firestore" ||
      source === "revenuecat" ||
      source === "both" ||
      source === "none"
    ) ||
    !(
      candidate.reconciledAt === null ||
      typeof candidate.reconciledAt === "string"
    )
  ) {
    const error = new Error("Invalid reconcile response payload")
    ;(error as { code?: string }).code = "invalid-response"
    throw error
  }

  return {
    isPremium: candidate.isPremium,
    source,
    reconciledAt: candidate.reconciledAt,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const firebaseAvailable = isFirebaseClientConfigured
  const firebaseUnavailableMessage = getFirebaseClientConfigErrorMessage()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(firebaseAvailable)
  const [premiumStatus, setPremiumStatus] = useState<PremiumStatus>("free")
  const [premiumLoading, setPremiumLoading] = useState(false)
  const [premiumLastCheckedAt, setPremiumLastCheckedAt] = useState<
    string | null
  >(null)
  const [serverSessionSync, setServerSessionSync] =
    useState<ServerSessionSyncSnapshot>({
      error: null,
      status: "idle",
      uid: null,
    })

  const premiumStatusRef = useRef<PremiumStatus>("free")
  const serverSessionSyncManagerRef = useRef(
    createServerSessionSyncManager(
      syncServerSessionWithIdToken,
      setServerSessionSync,
    ),
  )
  const reconcileAttemptedUsersRef = useRef<Set<string>>(new Set())
  const reconcileDependencyLoggedUsersRef = useRef<Set<string>>(new Set())
  const reconcileCallablesRef = useRef(
    new Map<
      ReconcileCallableName,
      ReturnType<typeof httpsCallable<unknown, unknown>>
    >(),
  )

  const getAuth = useCallback(() => getFirebaseAuth(), [])
  const getDb = useCallback(() => getFirebaseDb(), [])
  const getCallable = useCallback((name: ReconcileCallableName) => {
    const cachedCallable = reconcileCallablesRef.current.get(name)

    if (cachedCallable) {
      return cachedCallable
    }

    const callable = httpsCallable<unknown, unknown>(
      getFirebaseFunctions(),
      name,
    )
    reconcileCallablesRef.current.set(name, callable)
    return callable
  }, [])

  const hasAttemptedReconcile = useCallback((userId: string): boolean => {
    return (
      reconcileAttemptedUsersRef.current.has(userId) ||
      getSessionMarker(getReconcileAttemptKey(userId))
    )
  }, [])

  const markReconcileAttempted = useCallback((userId: string) => {
    reconcileAttemptedUsersRef.current.add(userId)
    setSessionMarker(getReconcileAttemptKey(userId))
  }, [])

  const hasLoggedDependencyError = useCallback((userId: string): boolean => {
    return (
      reconcileDependencyLoggedUsersRef.current.has(userId) ||
      getSessionMarker(getReconcileDependencyLoggedKey(userId))
    )
  }, [])

  const markDependencyErrorLogged = useCallback((userId: string) => {
    reconcileDependencyLoggedUsersRef.current.add(userId)
    setSessionMarker(getReconcileDependencyLoggedKey(userId))
  }, [])

  const clearServerSessionSyncState = useCallback(() => {
    serverSessionSyncManagerRef.current.clear()
  }, [])

  const ensureServerSession = useCallback(
    async (candidateUser?: User | null): Promise<ServerSessionSyncResult> => {
      if (!firebaseAvailable) {
        clearServerSessionSyncState()
        return {
          error: firebaseUnavailableMessage,
          ok: false,
          status: "error",
          uid: candidateUser?.uid ?? "missing-firebase-config",
        }
      }

      const auth = getAuth()
      const activeUser = candidateUser ?? auth.currentUser

      if (!activeUser || activeUser.isAnonymous) {
        clearServerSessionSyncState()
        return {
          error: "Missing authenticated user",
          ok: false,
          status: "error",
          uid: activeUser?.uid ?? "anonymous",
        }
      }

      try {
        const idToken = await activeUser.getIdToken()
        return serverSessionSyncManagerRef.current.ensure({
          isCurrentUser: () => auth.currentUser?.uid === activeUser.uid,
          token: idToken,
          uid: activeUser.uid,
        })
      } catch (error) {
        const message =
          error instanceof Error && error.message.trim()
            ? error.message
            : "Failed to fetch authentication token"

        return {
          error: message,
          ok: false,
          status: "error",
          uid: activeUser.uid,
        }
      }
    },
    [
      clearServerSessionSyncState,
      firebaseAvailable,
      firebaseUnavailableMessage,
      getAuth,
    ],
  )

  const markServerSessionReady = useCallback(
    async (candidateUser: User): Promise<ServerSessionSyncResult> => {
      if (!firebaseAvailable) {
        clearServerSessionSyncState()
        return {
          error: firebaseUnavailableMessage,
          ok: false,
          status: "error",
          uid: candidateUser.uid,
        }
      }

      if (!candidateUser || candidateUser.isAnonymous) {
        clearServerSessionSyncState()
        return {
          error: "Missing authenticated user",
          ok: false,
          status: "error",
          uid: candidateUser?.uid ?? "anonymous",
        }
      }

      try {
        const idToken = await candidateUser.getIdToken()
        return serverSessionSyncManagerRef.current.markReady({
          token: idToken,
          uid: candidateUser.uid,
        })
      } catch (error) {
        const message =
          error instanceof Error && error.message.trim()
            ? error.message
            : "Failed to fetch authentication token"

        return {
          error: message,
          ok: false,
          status: "error",
          uid: candidateUser.uid,
        }
      }
    },
    [
      clearServerSessionSyncState,
      firebaseAvailable,
      firebaseUnavailableMessage,
    ],
  )

  const reconcilePremium = useCallback(
    async (userId: string): Promise<void> => {
      if (!firebaseAvailable || !userId) {
        setPremiumLoading(false)
        return
      }

      const auth = getAuth()
      const statusBefore = premiumStatusRef.current

      if (!reconcileEnabled || hasAttemptedReconcile(userId)) {
        setPremiumLoading(false)
        return
      }

      markReconcileAttempted(userId)
      setPremiumLoading(true)
      try {
        let reconcileCompleted = false

        for (const callableName of RECONCILE_CALLABLE_ORDER) {
          const callable = getCallable(callableName)

          trackPremiumEvent(
            "premium_reconcile_started",
            createPremiumTelemetryPayload({
              uid: userId,
              premiumStatusBefore: statusBefore,
              premiumStatusAfter: statusBefore,
              attempted: true,
              callableName,
            }),
          )

          try {
            const response = await callable()

            if (auth.currentUser?.uid !== userId) {
              return
            }

            const parsedResponse = parseReconcilePremiumStatusResponse(
              callableName,
              response?.data,
            )
            const nowIso = new Date().toISOString()
            const nextPremiumStatus = resolvePremiumStatusFromReconcileResult({
              isPremium: parsedResponse.isPremium,
            })

            premiumStatusRef.current = nextPremiumStatus
            setPremiumStatus(nextPremiumStatus)
            setPremiumLastCheckedAt(parsedResponse.reconciledAt ?? nowIso)

            trackPremiumEvent(
              "premium_reconcile_succeeded",
              createPremiumTelemetryPayload({
                uid: userId,
                premiumStatusBefore: statusBefore,
                premiumStatusAfter: nextPremiumStatus,
                attempted: true,
                callableName,
                source: parsedResponse.source,
              }),
            )

            reconcileCompleted = true
            break
          } catch (error) {
            const errorCode = getReconcileErrorCode(error)

            if (
              isReconcileDependencyError(errorCode) &&
              !hasLoggedDependencyError(userId)
            ) {
              markDependencyErrorLogged(userId)
              console.error("[PremiumReconcileDependencyMissing]", {
                attempted: true,
                callableName,
                errorCode,
                uidSuffix: userId.slice(-6),
              })
            } else {
              console.error("Premium reconciliation failed:", {
                callableName,
                error,
              })
            }

            trackPremiumEvent(
              "premium_reconcile_failed",
              createPremiumTelemetryPayload({
                uid: userId,
                premiumStatusBefore: statusBefore,
                premiumStatusAfter: premiumStatusRef.current,
                attempted: true,
                callableName,
                errorCode,
              }),
            )

            const canFallbackToLegacyCallable =
              callableName === "reconcilePremiumStatus" &&
              shouldFallbackToLegacyReconcileCallable(errorCode)

            if (!canFallbackToLegacyCallable) {
              break
            }
          }
        }

        if (!reconcileCompleted && auth.currentUser?.uid === userId) {
          // Preserve current premium status on reconcile failures.
          setPremiumStatus(premiumStatusRef.current)
        }
      } finally {
        if (auth.currentUser?.uid === userId) {
          setPremiumLoading(false)
        }
      }
    },
    [
      firebaseAvailable,
      getAuth,
      getCallable,
      hasAttemptedReconcile,
      hasLoggedDependencyError,
      markDependencyErrorLogged,
      markReconcileAttempted,
    ],
  )

  useEffect(() => {
    premiumStatusRef.current = premiumStatus
  }, [premiumStatus])

  useEffect(() => {
    if (!firebaseAvailable) {
      clearServerSessionSyncState()
      setUser(null)
      setLoading(false)
      return
    }

    const auth = getAuth()
    const unsubscribe = onIdTokenChanged(auth, (currentUser) => {
      setUser(currentUser)
      setLoading(false)

      if (!currentUser) {
        clearServerSessionSyncState()
      }
    })

    return unsubscribe
  }, [clearServerSessionSyncState, firebaseAvailable, getAuth])

  useEffect(() => {
    if (!firebaseAvailable || !user) {
      premiumStatusRef.current = "free"
      setPremiumStatus("free")
      setPremiumLoading(false)
      setPremiumLastCheckedAt(null)
      return
    }

    const auth = getAuth()
    const db = getDb()
    premiumStatusRef.current = "unknown"
    setPremiumStatus("unknown")
    setPremiumLoading(true)
    setPremiumLastCheckedAt(null)

    const userDocRef = doc(db, "users", user.uid)
    const unsubscribe = onSnapshot(
      userDocRef,
      (snapshot) => {
        if (auth.currentUser?.uid !== user.uid) {
          return
        }

        const statusBefore = premiumStatusRef.current
        const nowIso = new Date().toISOString()
        const userData = snapshot.exists()
          ? (snapshot.data() as UserDocument)
          : undefined
        const nextIsPremium = userData?.premium?.isPremium === true
        const hasAttempted = hasAttemptedReconcile(user.uid)
        const statusResolution = resolvePremiumStatusFromSnapshot({
          currentStatus: statusBefore,
          hasAttemptedReconcile: hasAttempted,
          nextIsPremium,
        })

        const statusAfter = statusResolution.preserveCurrent
          ? statusBefore
          : statusResolution.nextStatus

        if (!statusResolution.preserveCurrent) {
          premiumStatusRef.current = statusAfter
          setPremiumStatus(statusAfter)
        }

        setPremiumLastCheckedAt(nowIso)
        trackPremiumEvent(
          "premium_snapshot_received",
          createPremiumTelemetryPayload({
            uid: user.uid,
            premiumStatusBefore: statusBefore,
            premiumStatusAfter: statusAfter,
          }),
        )

        if (nextIsPremium) {
          setPremiumLoading(false)
          return
        }

        if (
          reconcileEnabled &&
          shouldStartPremiumReconcile({
            hasAttemptedReconcile: hasAttempted,
            nextIsPremium,
          })
        ) {
          void reconcilePremium(user.uid)
          return
        }

        setPremiumLoading(false)
      },
      (error) => {
        const statusBefore = premiumStatusRef.current
        const statusAfter = resolvePremiumStatusOnListenerError({
          currentStatus: statusBefore,
        })

        premiumStatusRef.current = statusAfter
        setPremiumStatus(statusAfter)
        setPremiumLoading(false)

        trackPremiumEvent(
          "premium_snapshot_error",
          createPremiumTelemetryPayload({
            uid: user.uid,
            premiumStatusBefore: statusBefore,
            premiumStatusAfter: statusAfter,
            errorCode: getReconcileErrorCode(error),
          }),
        )

        console.error("Error listening to user document:", error)
      },
    )

    return unsubscribe
  }, [
    firebaseAvailable,
    getAuth,
    getDb,
    hasAttemptedReconcile,
    reconcilePremium,
    user,
  ])

  const signOut = async () => {
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" })

      if (!response.ok) {
        throw new Error("Failed to sign out from server")
      }

      if (firebaseAvailable) {
        await firebaseSignOut(getAuth())
      }
      clearServerSessionSyncState()
      router.push("/")
    } catch (error) {
      console.error("Error signing out:", error)
      throw error
    }
  }

  const isPremium = premiumStatus === "premium"

  return (
    <AuthContext.Provider
      value={{
        firebaseAvailable,
        user,
        loading,
        isPremium,
        premiumStatus,
        premiumLoading,
        premiumLastCheckedAt,
        serverSessionSync,
        ensureServerSession,
        markServerSessionReady,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
