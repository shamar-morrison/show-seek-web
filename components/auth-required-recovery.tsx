"use client"

import { AuthModal } from "@/components/auth-modal"
import { useAuth } from "@/context/auth-context"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useRef } from "react"
import { toast } from "sonner"

const AUTH_REQUIRED_MESSAGE = "Sign in to continue."

export type AuthRequiredRecoveryAction =
  | { type: "idle" }
  | { clearUrl: string; redirectTarget: string; type: "redirect" }
  | {
      clearUrl: string
      errorMessage: string
      redirectTarget: string
      type: "report-error"
    }
  | { clearUrl: string; redirectTarget: string; type: "repair-session" }
  | { clearUrl: string; redirectTarget: string; type: "show-auth" }
  | { clearUrl: string; redirectTarget: string; type: "wait-for-session" }

export function sanitizeAuthRedirectPath(pathname: string | null): string | null {
  if (!pathname || !pathname.startsWith("/") || pathname.startsWith("//")) {
    return null
  }

  try {
    const parsedUrl = new URL(pathname, "https://showseek.local")
    return `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`
  } catch {
    return null
  }
}

export function stripAuthRedirectParams(
  pathname: string,
  currentSearch: string,
): string {
  const searchParams = new URLSearchParams(currentSearch)
  searchParams.delete("auth")
  searchParams.delete("redirect")

  const nextSearch = searchParams.toString()
  return nextSearch ? `${pathname}?${nextSearch}` : pathname
}

export function resolveAuthRequiredRecoveryAction({
  authRequired,
  loading,
  pathname,
  redirectPath,
  search,
  serverSessionSync,
  user,
}: {
  authRequired: boolean
  loading: boolean
  pathname: string
  redirectPath: string | null
  search: string
  serverSessionSync: {
    error: string | null
    status: "idle" | "pending" | "ready" | "error"
    uid: string | null
  }
  user: { isAnonymous?: boolean; uid?: string } | null
}): AuthRequiredRecoveryAction {
  if (!authRequired || loading) {
    return { type: "idle" }
  }

  const redirectTarget = sanitizeAuthRedirectPath(redirectPath) ?? "/"
  const clearUrl = stripAuthRedirectParams(pathname, search)

  if (!user || user.isAnonymous) {
    return {
      clearUrl,
      redirectTarget,
      type: "show-auth",
    }
  }

  const hasCurrentUserSync = serverSessionSync.uid === user.uid

  if (hasCurrentUserSync && serverSessionSync.status === "ready") {
    return {
      clearUrl,
      redirectTarget,
      type: "redirect",
    }
  }

  if (hasCurrentUserSync && serverSessionSync.status === "pending") {
    return {
      clearUrl,
      redirectTarget,
      type: "wait-for-session",
    }
  }

  if (hasCurrentUserSync && serverSessionSync.status === "error") {
    return {
      clearUrl,
      errorMessage:
        serverSessionSync.error ??
        "We couldn't restore your session. Please try again.",
      redirectTarget,
      type: "report-error",
    }
  }

  return {
    clearUrl,
    redirectTarget,
    type: "repair-session",
  }
}

export function AuthRequiredRecovery() {
  const { ensureServerSession, loading, serverSessionSync, user } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const recoveryAttemptKeyRef = useRef<string | null>(null)
  const handledRecoveryStateKeyRef = useRef<string | null>(null)

  const search = searchParams.toString()
  const redirectPath = searchParams.get("redirect")
  const authRequired = searchParams.get("auth") === "required"
  const recoveryAction = useMemo(
    () =>
      resolveAuthRequiredRecoveryAction({
        authRequired,
        loading,
        pathname,
        redirectPath,
        search,
        serverSessionSync,
        user,
      }),
    [authRequired, loading, pathname, redirectPath, search, serverSessionSync, user],
  )
  const isModalOpen = useMemo(
    () => recoveryAction.type === "show-auth",
    [recoveryAction],
  )

  useEffect(() => {
    if (recoveryAction.type === "idle") {
      recoveryAttemptKeyRef.current = null
      handledRecoveryStateKeyRef.current = null
      return
    }

    if (recoveryAction.type === "show-auth") {
      recoveryAttemptKeyRef.current = null
      handledRecoveryStateKeyRef.current = null
      return
    }

    if (recoveryAction.type === "wait-for-session") {
      return
    }

    if (recoveryAction.type === "redirect") {
      const redirectKey = `${user?.uid ?? "unknown"}:${recoveryAction.redirectTarget}:redirect`

      if (handledRecoveryStateKeyRef.current === redirectKey) {
        return
      }

      handledRecoveryStateKeyRef.current = redirectKey
      router.replace(recoveryAction.redirectTarget)
      return
    }

    if (recoveryAction.type === "report-error") {
      const errorKey = `${user?.uid ?? "unknown"}:${recoveryAction.redirectTarget}:${recoveryAction.errorMessage}`

      if (handledRecoveryStateKeyRef.current === errorKey) {
        return
      }

      handledRecoveryStateKeyRef.current = errorKey
      recoveryAttemptKeyRef.current = null
      router.replace(recoveryAction.clearUrl)
      toast.error(recoveryAction.errorMessage)
      return
    }

    const recoveryAttemptKey = `${user?.uid ?? "unknown"}:${recoveryAction.redirectTarget}:${search}`

    if (recoveryAttemptKeyRef.current === recoveryAttemptKey) {
      return
    }

    recoveryAttemptKeyRef.current = recoveryAttemptKey
    handledRecoveryStateKeyRef.current = null
    let isCancelled = false

    void ensureServerSession(user)
      .then(() => {
        if (isCancelled) {
          return
        }

        recoveryAttemptKeyRef.current = null
      })
      .catch(() => {
        if (isCancelled) {
          return
        }

        recoveryAttemptKeyRef.current = null
      })

    return () => {
      isCancelled = true
    }
  }, [ensureServerSession, recoveryAction, router, search, user])

  if (recoveryAction.type === "idle") {
    return null
  }

  return (
    <AuthModal
      isOpen={isModalOpen}
      onClose={() => {
        recoveryAttemptKeyRef.current = null
        handledRecoveryStateKeyRef.current = null
        router.replace(recoveryAction.clearUrl)
      }}
      onAuthSuccess={async () => {
        recoveryAttemptKeyRef.current = null
        handledRecoveryStateKeyRef.current = null
      }}
      message={AUTH_REQUIRED_MESSAGE}
    />
  )
}
