"use client"

import { useAuth } from "@/context/auth-context"
import { useCallback, useRef, useState } from "react"
import { toast } from "sonner"

export function useAuthGuard() {
  const { user, loading } = useAuth()
  const [modalVisible, setModalVisible] = useState(false)
  const [modalMessage, setModalMessage] = useState<string | undefined>()
  const pendingActionRef = useRef<(() => void | Promise<void>) | null>(null)

  // User is authenticated if they exist and are NOT anonymous
  const isAuthenticated =
    !loading && user !== null && user.isAnonymous === false

  /**
   * Wraps an action with an authentication check.
   * Shows auth modal if user is not authenticated.
   * Stores the action for replay after successful authentication.
   */
  const requireAuth = useCallback(
    (action: () => void | Promise<void>, message?: string) => {
      if (isAuthenticated) {
        Promise.resolve(action()).catch((error) => {
          console.error("requireAuth action failed:", error)
        })
      } else {
        pendingActionRef.current = action
        setModalMessage(message)
        setModalVisible(true)
      }
    },
    [isAuthenticated],
  )

  const closeModal = useCallback(() => {
    setModalVisible(false)
    setModalMessage(undefined)
    pendingActionRef.current = null
  }, [])

  /**
   * Called after successful authentication to replay the stored pending action.
   */
  const onAuthSuccess = useCallback(async () => {
    toast.success("Signed in successfully!")
    const pendingAction = pendingActionRef.current
    pendingActionRef.current = null
    setModalVisible(false)
    setModalMessage(undefined)

    if (pendingAction) {
      // Small delay so the user sees the toast and auth state settles
      await new Promise((resolve) => setTimeout(resolve, 300))
      try {
        await Promise.resolve(pendingAction())
      } catch (error) {
        console.error("Pending auth action failed:", error)
      }
    }
  }, [])

  return {
    requireAuth,
    isAuthenticated,
    modalVisible,
    modalMessage,
    closeModal,
    onAuthSuccess,
  }
}
