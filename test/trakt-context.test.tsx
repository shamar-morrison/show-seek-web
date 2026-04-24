import { act, render, screen, waitFor } from "@/test/utils"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useState } from "react"

const mocks = vi.hoisted(() => {
  class TestTraktRequestError extends Error {
    category?: string
    nextAllowedEnrichAt?: string
    nextAllowedSyncAt?: string

    constructor(
      message: string,
      options: {
        category?: string
        nextAllowedEnrichAt?: string
        nextAllowedSyncAt?: string
      } = {},
    ) {
      super(message)
      this.name = "TraktRequestError"
      this.category = options.category
      this.nextAllowedEnrichAt = options.nextAllowedEnrichAt
      this.nextAllowedSyncAt = options.nextAllowedSyncAt
    }
  }

  return {
    TestTraktRequestError,
    authState: {
      loading: false,
      user: {
        isAnonymous: false,
        uid: "user-1",
      } as { isAnonymous: boolean; uid: string } | null,
    },
    checkEnrichmentStatus: vi.fn(),
    checkSyncStatus: vi.fn(),
    disconnectTrakt: vi.fn(),
    initiateOAuthFlow: vi.fn(),
    invalidateQueries: vi.fn(),
    triggerEnrichment: vi.fn(),
    triggerSync: vi.fn(),
  }
})

vi.mock("@/context/auth-context", () => ({
  useAuth: () => mocks.authState,
}))

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: mocks.invalidateQueries,
  }),
}))

vi.mock("@/services/trakt-service", () => ({
  TraktRequestError: mocks.TestTraktRequestError,
  checkEnrichmentStatus: mocks.checkEnrichmentStatus,
  checkSyncStatus: mocks.checkSyncStatus,
  disconnectTrakt: mocks.disconnectTrakt,
  initiateOAuthFlow: mocks.initiateOAuthFlow,
  triggerEnrichment: mocks.triggerEnrichment,
  triggerSync: mocks.triggerSync,
}))

function idleStatus(overrides: Record<string, unknown> = {}) {
  return {
    connected: false,
    status: "idle",
    synced: false,
    ...overrides,
  }
}

async function renderProbe() {
  const { TraktProvider, useTrakt } = await import("@/context/trakt-context")

  function Probe() {
    const trakt = useTrakt()
    const [error, setError] = useState("")

    return (
      <div>
        <div data-testid="connected">{String(trakt.isConnected)}</div>
        <div data-testid="loading">{String(trakt.isLoading)}</div>
        <div data-testid="syncing">{String(trakt.isSyncing)}</div>
        <div data-testid="status">{trakt.syncStatus?.status ?? "none"}</div>
        <div data-testid="last-synced">
          {trakt.lastSyncedAt?.toISOString() ?? "none"}
        </div>
        <div data-testid="error">{error}</div>
        <button
          onClick={() =>
            void trakt.connectTrakt().catch((caught: Error) => {
              setError(caught.message)
            })
          }
          type="button"
        >
          connect
        </button>
        <button
          onClick={() =>
            void trakt.syncNow().catch((caught: Error) => {
              setError(caught.message)
            })
          }
          type="button"
        >
          sync
        </button>
        <button
          onClick={() =>
            void trakt.disconnectTrakt().catch((caught: Error) => {
              setError(caught.message)
            })
          }
          type="button"
        >
          disconnect
        </button>
      </div>
    )
  }

  await act(async () => {
    render(
      <TraktProvider>
        <Probe />
      </TraktProvider>,
    )
    await Promise.resolve()
  })
}

describe("TraktProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mocks.authState.loading = false
    mocks.authState.user = {
      isAnonymous: false,
      uid: "user-1",
    }
    mocks.checkSyncStatus.mockResolvedValue(idleStatus())
    mocks.checkEnrichmentStatus.mockResolvedValue({
      lists: {},
      status: "idle",
    })
    mocks.disconnectTrakt.mockResolvedValue(undefined)
    mocks.initiateOAuthFlow.mockResolvedValue(undefined)
    mocks.triggerEnrichment.mockResolvedValue(undefined)
    mocks.triggerSync.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
    localStorage.clear()
  })

  it("rejects anonymous users before starting OAuth", async () => {
    mocks.authState.user = {
      isAnonymous: true,
      uid: "anon-1",
    }
    const user = userEvent.setup()

    await renderProbe()

    await user.click(screen.getByRole("button", { name: "connect" }))

    expect(screen.getByTestId("error")).toHaveTextContent(
      "Must be logged in to connect Trakt",
    )
    expect(mocks.initiateOAuthFlow).not.toHaveBeenCalled()
  })

  it("persists completed sync state from the backend", async () => {
    mocks.checkSyncStatus.mockResolvedValue(
      idleStatus({
        connected: true,
        lastSyncedAt: "2026-04-20T12:00:00.000Z",
        status: "completed",
        synced: true,
      }),
    )

    await renderProbe()

    await waitFor(() => {
      expect(screen.getByTestId("connected")).toHaveTextContent("true")
    })
    expect(screen.getByTestId("last-synced")).toHaveTextContent(
      "2026-04-20T12:00:00.000Z",
    )
    expect(
      JSON.parse(
        localStorage.getItem("showseek_trakt_state_v1_user-1") ?? "{}",
      ),
    ).toMatchObject({
      connected: true,
      lastSyncedAt: "2026-04-20T12:00:00.000Z",
      syncStatus: {
        status: "completed",
      },
    })
  })

  it("finishes the connect flow by checking status after the OAuth popup closes", async () => {
    const originalSetTimeout = window.setTimeout
    vi.spyOn(window, "setTimeout").mockImplementation(((
      handler: TimerHandler,
      timeout?: number,
      ...args: unknown[]
    ) => {
      if (timeout === 2000 && typeof handler === "function") {
        queueMicrotask(() => handler(...args))
        return originalSetTimeout(() => undefined, 0)
      }

      return originalSetTimeout(handler, timeout, ...args)
    }) as never)
    const user = userEvent.setup()

    await renderProbe()
    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("false")
    })
    const checksBeforeConnect = mocks.checkSyncStatus.mock.calls.length
    mocks.checkSyncStatus.mockResolvedValueOnce(
      idleStatus({
        connected: true,
        lastSyncedAt: "2026-04-20T12:00:00.000Z",
        status: "completed",
        synced: true,
      }),
    )

    await user.click(screen.getByRole("button", { name: "connect" }))

    expect(mocks.initiateOAuthFlow).toHaveBeenCalled()
    await waitFor(() => {
      expect(mocks.checkSyncStatus.mock.calls.length).toBeGreaterThan(
        checksBeforeConnect,
      )
    })
  })

  it("invalidates imported data after a completed manual sync", async () => {
    mocks.checkSyncStatus.mockResolvedValue(
      idleStatus({
        connected: true,
        lastSyncedAt: "2026-04-20T12:00:00.000Z",
        status: "completed",
        synced: true,
      }),
    )
    const user = userEvent.setup()

    await renderProbe()

    await waitFor(() => {
      expect(screen.getByTestId("connected")).toHaveTextContent("true")
    })
    await user.click(screen.getByRole("button", { name: "sync" }))

    await waitFor(() => {
      expect(mocks.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["firestore", "lists", "user-1"],
      })
    })
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["firestore", "lists", "user-1"],
    })
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["firestore", "ratings", "user-1"],
    })
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["firestore", "episode-tracking", "user-1"],
    })
  })

  it("stores rate-limit details when manual sync is blocked", async () => {
    mocks.checkSyncStatus.mockResolvedValue(
      idleStatus({
        connected: true,
        status: "completed",
        synced: true,
      }),
    )
    mocks.triggerSync.mockRejectedValue(
      new mocks.TestTraktRequestError("Try again later", {
        category: "rate_limited",
        nextAllowedSyncAt: "2026-04-25T00:00:00.000Z",
      }),
    )
    const user = userEvent.setup()

    await renderProbe()
    await waitFor(() => {
      expect(screen.getByTestId("connected")).toHaveTextContent("true")
    })

    await user.click(screen.getByRole("button", { name: "sync" }))

    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("failed")
    })
    expect(screen.getByTestId("error")).toHaveTextContent("Try again later")
  })

  it("resets local state and invalidates caches on disconnect", async () => {
    mocks.checkSyncStatus.mockResolvedValue(
      idleStatus({
        connected: true,
        lastSyncedAt: "2026-04-20T12:00:00.000Z",
        status: "completed",
        synced: true,
      }),
    )
    const user = userEvent.setup()

    await renderProbe()
    await waitFor(() => {
      expect(screen.getByTestId("connected")).toHaveTextContent("true")
    })

    await user.click(screen.getByRole("button", { name: "disconnect" }))

    await waitFor(() => {
      expect(screen.getByTestId("connected")).toHaveTextContent("false")
    })
    expect(mocks.disconnectTrakt).toHaveBeenCalled()
    expect(localStorage.getItem("showseek_trakt_state_v1_user-1")).toBeNull()
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["firestore", "lists", "user-1"],
    })
  })
})
