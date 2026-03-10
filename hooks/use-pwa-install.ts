"use client"

import { useCallback, useEffect, useState, useSyncExternalStore } from "react"

export interface PWAInstallPreference {
  status: "accepted" | "rejected" | "dismissed"
  timestamp: number
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

const STORAGE_KEY = "pwa-install-preference"
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
const STANDALONE_MEDIA_QUERY = "(display-mode: standalone)"
const PREFERENCE_CHANGE_EVENT = "pwa-install-preference-change"

let cachedPreferenceValue: string | null | undefined
let cachedPreferenceSnapshot: PWAInstallPreference | null = null

function getPreference(): PWAInstallPreference | null {
  if (typeof window === "undefined") return null

  let stored: string | null
  try {
    stored = localStorage.getItem(STORAGE_KEY)
  } catch {
    cachedPreferenceValue = undefined
    cachedPreferenceSnapshot = null
    return null
  }

  if (stored === cachedPreferenceValue) {
    return cachedPreferenceSnapshot
  }

  if (!stored) {
    cachedPreferenceValue = stored
    cachedPreferenceSnapshot = null
    return null
  }

  try {
    cachedPreferenceValue = stored
    cachedPreferenceSnapshot = JSON.parse(stored) as PWAInstallPreference
    return cachedPreferenceSnapshot
  } catch {
    cachedPreferenceValue = stored
    cachedPreferenceSnapshot = null
    return null
  }
}

function setPreference(status: PWAInstallPreference["status"]): void {
  try {
    const pref: PWAInstallPreference = { status, timestamp: Date.now() }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pref))
  } catch {
    // localStorage unavailable or full
  }

  window.dispatchEvent(new Event(PREFERENCE_CHANGE_EVENT))
}

function shouldShowPrompt(pref: PWAInstallPreference | null): boolean {
  if (!pref) return true

  if (pref.status === "accepted" || pref.status === "rejected") {
    return false
  }

  // If dismissed, check if 7 days have passed
  if (pref.status === "dismissed") {
    const elapsed = Date.now() - pref.timestamp
    return elapsed >= DISMISS_DURATION_MS
  }

  return true
}

function isDesktop(): boolean {
  if (typeof window === "undefined") return false
  // Check if NOT a mobile/tablet device
  const userAgent = navigator.userAgent.toLowerCase()
  const isMobile =
    /iphone|ipad|ipod|android|webos|blackberry|windows phone/i.test(userAgent)
  // Also check screen width as a fallback
  const isNarrowScreen = window.innerWidth < 1024
  return !isMobile && !isNarrowScreen
}

function isSupportedBrowser(): boolean {
  if (typeof window === "undefined") return false
  const ua = navigator.userAgent.toLowerCase()
  // Only Chromium-based browsers support beforeinstallprompt (Chrome, Edge, Opera, Brave, Samsung Internet, etc.)
  // Firefox does NOT support beforeinstallprompt
  const isChromium =
    "chrome" in window ||
    ua.includes("chrome") ||
    ua.includes("chromium") ||
    ua.includes("edg")
  return isChromium
}

function subscribeToStandaloneMode(onStoreChange: () => void) {
  const mediaQuery = window.matchMedia(STANDALONE_MEDIA_QUERY)
  mediaQuery.addEventListener("change", onStoreChange)

  return () => {
    mediaQuery.removeEventListener("change", onStoreChange)
  }
}

function getStandaloneModeSnapshot() {
  return window.matchMedia(STANDALONE_MEDIA_QUERY).matches
}

function getStandaloneModeServerSnapshot() {
  return false
}

function subscribeToInstallPreference(onStoreChange: () => void) {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === STORAGE_KEY) {
      onStoreChange()
    }
  }
  const handlePreferenceChange = () => onStoreChange()

  window.addEventListener("storage", handleStorage)
  window.addEventListener(PREFERENCE_CHANGE_EVENT, handlePreferenceChange)

  return () => {
    window.removeEventListener("storage", handleStorage)
    window.removeEventListener(PREFERENCE_CHANGE_EVENT, handlePreferenceChange)
  }
}

function getPreferenceServerSnapshot() {
  return null
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const installPreference = useSyncExternalStore(
    subscribeToInstallPreference,
    getPreference,
    getPreferenceServerSnapshot,
  )
  const standaloneMode = useSyncExternalStore(
    subscribeToStandaloneMode,
    getStandaloneModeSnapshot,
    getStandaloneModeServerSnapshot,
  )
  const isInstalled = standaloneMode

  useEffect(() => {
    if (isInstalled) {
      return
    }

    // Only show on desktop + supported browsers
    if (!isDesktop() || !isSupportedBrowser()) {
      return
    }

    // Check localStorage preference
    if (!shouldShowPrompt(installPreference)) {
      return
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setShowPrompt(true)
    }

    const handleAppInstalled = () => {
      setPreference("accepted")
      setShowPrompt(false)
      setDeferredPrompt(null)
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
    window.addEventListener("appinstalled", handleAppInstalled)

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      )
      window.removeEventListener("appinstalled", handleAppInstalled)
    }
  }, [installPreference, isInstalled])

  const install = useCallback(async () => {
    if (!deferredPrompt) return false

    try {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice

      if (outcome === "accepted") {
        setPreference("accepted")
        setShowPrompt(false)
        setDeferredPrompt(null)
        return true
      }
    } catch {
      // User cancelled or error
    }

    return false
  }, [deferredPrompt])

  const dismiss = useCallback(() => {
    setPreference("dismissed")
    setShowPrompt(false)
  }, [])

  const cancel = useCallback(() => {
    setPreference("rejected")
    setShowPrompt(false)
  }, [])

  return {
    showPrompt: showPrompt && !isInstalled,
    isInstalled,
    installPreference,
    install,
    dismiss,
    cancel,
  }
}
