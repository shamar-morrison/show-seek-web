"use client"

import { useAuth } from "@/context/auth-context"
import { useEffect, useState } from "react"

/**
 * Options for the generic Firestore subscription hook
 */
interface UseFirestoreSubscriptionOptions<T> {
  /**
   * Function to subscribe to Firestore data
   * Should return an unsubscribe function
   */
  subscribe: (
    userId: string,
    onData: (data: T) => void,
    onError: (error: Error) => void,
  ) => () => void
  /** Initial value for the data */
  initialValue: T
  /** If true, skip subscription (e.g. for anonymous users) */
  skip?: boolean
}

interface UseFirestoreSubscriptionResult<T> {
  data: T
  loading: boolean
  error: Error | null
}

/**
 * Generic hook for subscribing to Firestore user data
 * Handles authentication check, loading state, error handling, and cleanup
 */
export function useFirestoreSubscription<T>({
  subscribe,
  initialValue,
  skip = false,
}: UseFirestoreSubscriptionOptions<T>): UseFirestoreSubscriptionResult<T> {
  const { user, loading: authLoading } = useAuth()
  const [data, setData] = useState<T>(initialValue)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    // Wait for auth to load
    if (authLoading) return

    // Reset state for unauthenticated or anonymous users, or when skipped
    if (!user || user.isAnonymous || skip) {
      setData(initialValue)
      setLoading(false)
      setError(null)
      return
    }

    // Start subscription
    setLoading(true)
    setError(null)

    const unsubscribe = subscribe(
      user.uid,
      (newData) => {
        setData(newData)
        setLoading(false)
        setError(null)
      },
      (err) => {
        console.error("Firestore subscription error:", err)
        setError(err)
        setLoading(false)
      },
    )

    return () => unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, skip])

  return { data, loading, error }
}
