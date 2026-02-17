"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState, type ReactNode } from "react"

interface QueryProviderProps {
  children: ReactNode
}

/**
 * React Query provider wrapper
 * Creates a single QueryClient instance per component tree
 */
export function QueryProvider({ children }: QueryProviderProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // 30 minutes stale time - data is considered fresh for this duration
            staleTime: 30 * 60 * 1000,
            // 24 hour cache time - profile-oriented data stays cached between views
            gcTime: 24 * 60 * 60 * 1000,
            // Retry failed requests once
            retry: 1,
            // Migrated Firestore reads rely on mutation-driven invalidation
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
            refetchOnMount: false,
          },
        },
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}
