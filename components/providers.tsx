"use client"

import { QueryProvider } from "@/components/query-provider"
import { AuthProvider } from "@/context/auth-context"
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
        {children}
        <AppClientShell />
      </AuthProvider>
    </QueryProvider>
  )
}
