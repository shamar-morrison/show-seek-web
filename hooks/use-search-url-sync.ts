"use client"

import { useSearchParams } from "next/navigation"
import { useEffect, useRef } from "react"

interface UseSearchUrlSyncProps {
  /** Current search query state */
  query: string
  /** Function to update query state */
  setQuery: (query: string) => void
  /** Function to perform the search */
  performSearch: (query: string) => void
}

/**
 * Hook to synchronize search state with URL parameters
 * Handles back/forward navigation and direct URL updates
 */
export function useSearchUrlSync({
  query,
  setQuery,
  performSearch,
}: UseSearchUrlSyncProps) {
  const searchParams = useSearchParams()

  // Track current query ref to avoid dependency cycles in effect
  const queryRef = useRef(query)
  const isInitialMount = useRef(true)

  // Update ref when query changes
  useEffect(() => {
    queryRef.current = query
  }, [query])

  // Sync with URL params (e.g. back/forward navigation)
  useEffect(() => {
    // Skip on initial mount since initialResults is already provided
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }

    const urlQuery = searchParams.get("q") || ""
    if (urlQuery !== queryRef.current) {
      setQuery(urlQuery)
      if (urlQuery) {
        performSearch(urlQuery)
      }
    }
  }, [searchParams, performSearch, setQuery])
}
