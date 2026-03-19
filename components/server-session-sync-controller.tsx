"use client"

import { useAuth } from "@/context/auth-context"
import { usePathname, useSearchParams } from "next/navigation"
import { useEffect, useMemo } from "react"

const EAGER_SERVER_SESSION_PATH_PREFIXES = [
  "/calendar",
  "/for-you",
  "/lists",
  "/profile",
  "/ratings",
] as const

export function ServerSessionSyncController() {
  const { ensureServerSession, firebaseAvailable, user } = useAuth()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const shouldAutoEnsureServerSession = useMemo(() => {
    if (searchParams.get("auth") === "required") {
      return true
    }

    return EAGER_SERVER_SESSION_PATH_PREFIXES.some(
      (prefix) =>
        pathname === prefix || (pathname !== null && pathname.startsWith(`${prefix}/`)),
    )
  }, [pathname, searchParams])

  useEffect(() => {
    if (
      !firebaseAvailable ||
      !shouldAutoEnsureServerSession ||
      !user ||
      user.isAnonymous
    ) {
      return
    }

    let isCancelled = false

    void ensureServerSession(user)
      .then((result) => {
        if (isCancelled || result.ok) {
          return
        }

        console.error("Server session sync failed:", {
          reason: result.error,
          uidSuffix: user.uid.slice(-6),
        })
      })
      .catch((error) => {
        if (isCancelled) {
          return
        }

        console.error("Server session sync rejected:", {
          reason: error instanceof Error ? error.message : "Unknown error",
          uidSuffix: user.uid.slice(-6),
        })
      })

    return () => {
      isCancelled = true
    }
  }, [ensureServerSession, firebaseAvailable, shouldAutoEnsureServerSession, user])

  return null
}
