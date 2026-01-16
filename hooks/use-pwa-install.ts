"use client"

import { useCallback, useEffect, useState } from "react"

interface PWAInstallPreference {
  status: "accepted" | "rejected" | "dismissed"
  timestamp: number
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

const STORAGE_KEY = "pwa-install-preference"
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

function getPreference(): PWAInstallPreference | null {
  if (typeof window === "undefined") return null
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return null
    return JSON.parse(stored) as PWAInstallPreference
  } catch {
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
}

function shouldShowPrompt(): boolean {
  const pref = getPreference()
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

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true)
      return
    }

    // Only show on desktop + supported browsers
    if (!isDesktop() || !isSupportedBrowser()) {
      return
    }

    // Check localStorage preference
    if (!shouldShowPrompt()) {
      return
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setShowPrompt(true)
    }

    const handleAppInstalled = () => {
      setIsInstalled(true)
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
  }, [])

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
    showPrompt,
    isInstalled,
    install,
    dismiss,
    cancel,
  }
}
