"use client"

import { AuthRequiredRecovery } from "@/components/auth-required-recovery"
import { OfflineIndicator } from "@/components/offline-indicator"
import { PWAInstallPrompt } from "@/components/pwa-install-prompt"
import { QueryProvider } from "@/components/query-provider"
import { AuthProvider } from "@/context/auth-context"
import { ReactNode, Suspense, useEffect } from "react"

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

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <AuthProvider>
        {children}
        <Suspense fallback={null}>
          <AuthRequiredRecovery />
        </Suspense>
        <ServiceWorkerRegistration />
        <PWAInstallPrompt />
        <OfflineIndicator />
      </AuthProvider>
    </QueryProvider>
  )
}
