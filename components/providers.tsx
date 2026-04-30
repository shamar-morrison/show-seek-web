"use client"

import { PreferencesBootstrap } from "@/components/preferences-bootstrap"
import { QueryProvider } from "@/components/query-provider"
import { AuthProvider } from "@/context/auth-context"
import { TraktProvider } from "@/context/trakt-context"
import dynamic from "next/dynamic"
import { type ReactNode } from "react"

const AppClientShell = dynamic(
  () =>
    import("@/components/app-client-shell").then(
      (module) => module.AppClientShell,
    ),
  { ssr: false },
)

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <AuthProvider>
        <PreferencesBootstrap />
        <TraktProvider>
          {children}
          <AppClientShell />
        </TraktProvider>
      </AuthProvider>
    </QueryProvider>
  )
}
