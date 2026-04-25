import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  currentUser: {
    getIdToken: vi.fn(async () => "firebase-id-token"),
    isAnonymous: false,
  },
}))

vi.mock("@/lib/firebase/config", () => ({
  getFirebaseAuth: () => ({
    currentUser: mocks.currentUser,
  }),
}))

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json",
    },
    status,
  })
}

async function flushPromises() {
  await Promise.resolve()
  await Promise.resolve()
}

describe("TraktService OAuth flow", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    vi.stubGlobal("fetch", vi.fn())
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it("keeps polling after the popup closes until the backend reports connected", async () => {
    const popup = { closed: false }
    vi.spyOn(window, "open").mockReturnValue(popup as Window)
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        jsonResponse({ authUrl: "https://trakt.test/oauth" }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ connected: false, status: "idle", synced: false }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ connected: false, status: "idle", synced: false }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ connected: true, status: "idle", synced: false }),
      )

    const { initiateOAuthFlow } = await import("@/services/trakt-service")
    const resultPromise = initiateOAuthFlow({
      closedGraceMs: 500,
      pollIntervalMs: 100,
      timeoutMs: 1000,
    })

    await flushPromises()
    popup.closed = true
    await vi.advanceTimersByTimeAsync(100)
    await vi.advanceTimersByTimeAsync(100)

    await expect(resultPromise).resolves.toMatchObject({
      connected: true,
      synced: false,
    })
    expect(fetch).toHaveBeenCalledTimes(4)
  })

  it("rejects shortly after the user closes the OAuth popup without connecting", async () => {
    const popup = { closed: false, opener: {} }
    vi.spyOn(window, "open").mockImplementation((_url, _target, features) => {
      if (String(features).includes("noopener")) {
        return null
      }

      return popup as Window
    })
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        jsonResponse({ authUrl: "https://trakt.test/oauth" }),
      )
      .mockImplementation(async () =>
        jsonResponse({ connected: false, status: "idle", synced: false }),
      )

    const { initiateOAuthFlow } = await import("@/services/trakt-service")
    const resultPromise = initiateOAuthFlow({
      closedGraceMs: 200,
      pollIntervalMs: 50,
      timeoutMs: 5000,
    })
    const rejectionExpectation = expect(resultPromise).rejects.toThrow(
      "Trakt connection was not confirmed",
    )

    await flushPromises()
    popup.closed = true
    await vi.advanceTimersByTimeAsync(300)

    await rejectionExpectation
    expect(window.open).toHaveBeenCalledTimes(1)
    expect(window.open).toHaveBeenCalledWith(
      "https://trakt.test/oauth",
      "showseek-trakt-oauth",
      expect.not.stringContaining("noopener"),
    )
  })

  it("resolves immediately when the backend is already connected", async () => {
    const popup = { closed: false }
    vi.spyOn(window, "open").mockReturnValue(popup as Window)
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        jsonResponse({ authUrl: "https://trakt.test/oauth" }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ connected: true, status: "idle", synced: false }),
      )

    const { initiateOAuthFlow } = await import("@/services/trakt-service")

    await expect(
      initiateOAuthFlow({
        closedGraceMs: 500,
        pollIntervalMs: 100,
        timeoutMs: 1000,
      }),
    ).resolves.toMatchObject({
      connected: true,
      synced: false,
    })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it("polls even when the popup is blocked and a fallback tab is opened", async () => {
    vi.spyOn(window, "open").mockReturnValue(null)
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        jsonResponse({ authUrl: "https://trakt.test/oauth" }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ connected: false, status: "idle", synced: false }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ connected: true, status: "idle", synced: false }),
      )

    const { initiateOAuthFlow } = await import("@/services/trakt-service")
    const resultPromise = initiateOAuthFlow({
      closedGraceMs: 500,
      pollIntervalMs: 100,
      timeoutMs: 1000,
    })

    await flushPromises()
    await vi.advanceTimersByTimeAsync(100)

    await expect(resultPromise).resolves.toMatchObject({
      connected: true,
      synced: false,
    })
    expect(window.open).toHaveBeenCalledTimes(2)
  })

  it("times out when authorization is never confirmed", async () => {
    const popup = { closed: false }
    vi.spyOn(window, "open").mockReturnValue(popup as Window)
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        jsonResponse({ authUrl: "https://trakt.test/oauth" }),
      )
      .mockImplementation(async () =>
        jsonResponse({ connected: false, status: "idle", synced: false }),
      )

    const { initiateOAuthFlow } = await import("@/services/trakt-service")
    const resultPromise = initiateOAuthFlow({
      closedGraceMs: 500,
      pollIntervalMs: 100,
      timeoutMs: 250,
    })
    const rejectionExpectation = expect(resultPromise).rejects.toThrow(
      "Trakt connection was not confirmed",
    )

    await flushPromises()
    await vi.runAllTimersAsync()

    await rejectionExpectation
  })

  it("treats empty successful write responses as success", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }))

    const { disconnectTrakt } = await import("@/services/trakt-service")

    await expect(disconnectTrakt()).resolves.toBeUndefined()
  })
})
