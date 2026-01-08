"use client"

import { AuthModal } from "@/components/auth-modal"
import { useAuth } from "@/context/auth-context"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { LockIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import React from "react"

interface RouteGuardProps {
  children: React.ReactNode
  title?: string
  message?: string
}

/**
 * RouteGuard Component
 * Protects a route by checking authentication status.
 * If not authenticated, displays an empty state with an AuthModal trigger.
 */
export function RouteGuard({
  children,
  title = "Protected Content",
  message = "Please sign in to access this page.",
}: RouteGuardProps) {
  const { user, loading } = useAuth()

  // Show nothing while loading auth state
  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  // If authenticated, render children
  if (user && !user.isAnonymous) {
    return <>{children}</>
  }

  // If not authenticated, show protected state
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center p-4">
      <Empty className="max-w-md border border-white/10">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <HugeiconsIcon icon={LockIcon} className="text-primary" />
          </EmptyMedia>
          <EmptyTitle>{title}</EmptyTitle>
          <EmptyDescription>{message}</EmptyDescription>
        </EmptyHeader>
        <AuthModal message={message} />
      </Empty>
    </div>
  )
}
