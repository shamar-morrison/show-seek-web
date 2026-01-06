"use client"

import { useAuth } from "@/context/AuthContext"
import { useCallback, useState } from "react"

export function useAuthGuard() {
  const { user, loading } = useAuth()
  const [modalVisible, setModalVisible] = useState(false)
  const [modalMessage, setModalMessage] = useState<string | undefined>()

  // User is authenticated if they exist and are NOT anonymous
  const isAuthenticated =
    !loading && user !== null && user.isAnonymous === false

  /**
   * Wraps an action with an authentication check.
   * Shows auth modal if user is not authenticated.
   */
  const requireAuth = useCallback(
    (action: () => void | Promise<void>, message?: string) => {
      if (isAuthenticated) {
        action()
      } else {
        setModalMessage(message)
        setModalVisible(true)
      }
    },
    [isAuthenticated],
  )

  const closeModal = useCallback(() => {
    setModalVisible(false)
    setModalMessage(undefined)
  }, [])

  return {
    requireAuth,
    isAuthenticated,
    modalVisible,
    modalMessage,
    closeModal,
  }
}
