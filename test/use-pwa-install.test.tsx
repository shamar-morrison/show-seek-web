import { act, renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { usePWAInstall } from "../hooks/use-pwa-install"

type InstallPreferenceStatus = "accepted" | "rejected" | "dismissed"

const STORAGE_KEY = "pwa-install-preference"
const STANDALONE_MEDIA_QUERY = "(display-mode: standalone)"
const defaultMatchMedia = window.matchMedia
const defaultInnerWidth = window.innerWidth

function setStoredPreference(
  status: InstallPreferenceStatus,
  timestamp = Date.now(),
) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ status, timestamp }))
}

function mockMatchMedia(standaloneMode: boolean) {
  window.matchMedia = vi.fn((query: string) => {
    return {
      get matches() {
        return query === STANDALONE_MEDIA_QUERY ? standaloneMode : false
      },
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    } as MediaQueryList
  }) as typeof window.matchMedia
}

function createBeforeInstallPromptEvent(
  outcome: "accepted" | "dismissed" = "accepted",
) {
  const event = new Event("beforeinstallprompt") as Event & {
    prompt: () => Promise<void>
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
  }

  event.prompt = vi.fn(async () => {})
  event.userChoice = Promise.resolve({ outcome })

  return event
}

describe("usePWAInstall", () => {
  beforeEach(() => {
    localStorage.clear()
    mockMatchMedia(false)
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 1440,
    })
    ;(window as Window & { chrome?: object }).chrome = {}
  })

  afterEach(() => {
    localStorage.clear()
    window.matchMedia = defaultMatchMedia
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: defaultInnerWidth,
    })
    delete (window as Window & { chrome?: object }).chrome
  })

  it("keeps accepted preference separate from installed state", () => {
    setStoredPreference("accepted")

    const { result } = renderHook(() => usePWAInstall())

    expect(result.current.installPreference?.status).toBe("accepted")
    expect(result.current.isInstalled).toBe(false)

    act(() => {
      window.dispatchEvent(createBeforeInstallPromptEvent())
    })

    expect(result.current.showPrompt).toBe(false)
  })

  it("treats standalone mode as installed", () => {
    mockMatchMedia(true)

    const { result } = renderHook(() => usePWAInstall())

    expect(result.current.isInstalled).toBe(true)
    expect(result.current.installPreference).toBeNull()
  })

  it("persists acceptance when appinstalled fires and hides the prompt", async () => {
    const { result } = renderHook(() => usePWAInstall())

    act(() => {
      window.dispatchEvent(createBeforeInstallPromptEvent())
    })

    await waitFor(() => {
      expect(result.current.showPrompt).toBe(true)
    })

    act(() => {
      window.dispatchEvent(new Event("appinstalled"))
    })

    await waitFor(() => {
      expect(result.current.installPreference?.status).toBe("accepted")
    })

    expect(result.current.showPrompt).toBe(false)
    expect(result.current.isInstalled).toBe(false)
    expect(
      JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null")?.status,
    ).toBe("accepted")
  })

  it("continues to respect dismissed preference expiration", async () => {
    setStoredPreference("dismissed", Date.now() - 60 * 60 * 1000)

    const recentDismissal = renderHook(() => usePWAInstall())

    act(() => {
      window.dispatchEvent(createBeforeInstallPromptEvent())
    })

    expect(recentDismissal.result.current.showPrompt).toBe(false)

    recentDismissal.unmount()

    setStoredPreference("dismissed", Date.now() - 8 * 24 * 60 * 60 * 1000)

    const expiredDismissal = renderHook(() => usePWAInstall())

    act(() => {
      window.dispatchEvent(createBeforeInstallPromptEvent())
    })

    await waitFor(() => {
      expect(expiredDismissal.result.current.showPrompt).toBe(true)
    })
  })
})
