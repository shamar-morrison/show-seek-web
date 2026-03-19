"use client"

import { AuthRequiredRecovery } from "@/components/auth-required-recovery"
import { OfflineIndicator } from "@/components/offline-indicator"
import { PWAInstallPrompt } from "@/components/pwa-install-prompt"
import { ServerSessionSyncController } from "@/components/server-session-sync-controller"
import NextTopLoader from "nextjs-toploader"
import { Suspense, useEffect } from "react"
import { Toaster } from "sonner"

function ServiceWorkerRegistration() {
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      process.env.NODE_ENV === "production"
    ) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log("SW registered:", registration.scope)
        })
        .catch((error) => {
          console.log("SW registration failed:", error)
        })
    }
  }, [])

  return null
}

export function AppClientShell() {
  return (
    <>
      <NextTopLoader color="#E50914" showSpinner={false} />
      <Suspense fallback={null}>
        <ServerSessionSyncController />
      </Suspense>
      <Suspense fallback={null}>
        <AuthRequiredRecovery />
      </Suspense>
      <ServiceWorkerRegistration />
      <PWAInstallPrompt />
      <OfflineIndicator />
      <Toaster position="top-center" richColors theme="dark" />
    </>
  )
}
