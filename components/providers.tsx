"use client"

import { QueryProvider } from "@/components/query-provider"
import { AuthProvider } from "@/context/auth-context"
import { ReactNode } from "react"

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <AuthProvider>{children}</AuthProvider>
    </QueryProvider>
  )
}
