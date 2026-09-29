import { IDBFactory } from "fake-indexeddb"
import {
  QueryClient,
  QueryClientProvider,
  focusManager,
} from "@tanstack/react-query"
import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"
import { useHistory } from "@/hooks/use-history"
import {
  createHistoryStorage,
  HISTORY_SCHEMA_VERSION,
} from "@/lib/history/storage"
import {
  HISTORY_COLLECTIONS,
  HISTORY_FRESH_MS,
  historyKey,
} from "@/lib/history/keys"
import { getHistoryCache } from "@/lib/history/cache"

const { fetcher, auth } = vi.hoisted(() => ({
  fetcher: vi.fn(),
  auth: {
    user: { uid: "hook-user", isAnonymous: false } as {
      uid: string
      isAnonymous: boolean
    } | null,
    loading: false,
  },
}))
vi.mock("@/context/auth-context", () => ({ useAuth: () => auth }))
vi.mock("@/lib/history/source", () => ({ fetchHistoryCollection: fetcher }))
const NOW = new Date(2026, 2, 9, 12).getTime()
const genres = {}
let client: QueryClient
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(NOW)
  vi.stubGlobal("indexedDB", new IDBFactory())
  sessionStorage.clear()
  auth.user = { uid: "hook-user", isAnonymous: false }
  auth.loading = false
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  })
  fetcher.mockReset().mockResolvedValue([])
})
afterEach(() => {
  client.clear()
  focusManager.setFocused(undefined)
  vi.useRealTimers()
})

async function persist() {
  for (const kind of HISTORY_COLLECTIONS)
    await createHistoryStorage().put(
      `showseek:history:v${HISTORY_SCHEMA_VERSION}:hook-user:${kind}`,
      { version: HISTORY_SCHEMA_VERSION, updatedAt: NOW, data: [] },
    )
}

describe("history query lifecycle", () => {
  it("gates all reads on restoration and uses fresh persisted data without a startup request", async () => {
    await persist()
    const hook = renderHook(() => useHistory(genres), { wrapper })
    expect(fetcher).not.toHaveBeenCalled()
    await waitFor(() => expect(hook.result.current.loading).toBe(false))
    expect(fetcher).not.toHaveBeenCalled()
    expect(hook.result.current.overview?.totalWatched).toBe(0)
    expect(
      client.getQueryState(historyKey("hook-user", "lists"))?.dataUpdatedAt,
    ).toBe(NOW)
  })
  it("does not fetch for unresolved auth, guests, or anonymous users", async () => {
    auth.loading = true
    const hook = renderHook(() => useHistory(genres), { wrapper })
    await act(async () => {})
    auth.loading = false
    auth.user = null
    hook.rerender()
    await act(async () => {})
    auth.user = { uid: "anon", isAnonymous: true }
    hook.rerender()
    await act(async () => {})
    expect(fetcher).not.toHaveBeenCalled()
  })
  it("shares all source reads across month navigation, concurrent consumers, and remounts", async () => {
    const hook = renderHook(
      ({ month }) => ({
        overview: useHistory(genres),
        detail: useHistory(genres, month),
      }),
      { wrapper, initialProps: { month: "2026-03" } },
    )
    await waitFor(() =>
      expect(hook.result.current.overview.loading).toBe(false),
    )
    expect(fetcher).toHaveBeenCalledTimes(3)
    for (const month of ["2026-02", "2026-01", "2026-03"])
      hook.rerender({ month })
    hook.unmount()
    const returning = renderHook(() => useHistory(genres), { wrapper })
    await waitFor(() => expect(returning.result.current.loading).toBe(false))
    expect(fetcher).toHaveBeenCalledTimes(3)
  })
  it("refetches on stale focus but ignores repeated fresh focus", async () => {
    const hook = renderHook(() => useHistory(genres), { wrapper })
    await waitFor(() => expect(hook.result.current.loading).toBe(false))
    await act(async () => {
      focusManager.setFocused(false)
      focusManager.setFocused(true)
    })
    expect(fetcher).toHaveBeenCalledTimes(3)
    vi.setSystemTime(NOW + HISTORY_FRESH_MS)
    await act(async () => {
      focusManager.setFocused(false)
      focusManager.setFocused(true)
    })
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(6))
    await waitFor(() => expect(hook.result.current.fetching).toBe(false))
    await act(async () => {
      focusManager.setFocused(false)
      focusManager.setFocused(true)
    })
    expect(fetcher).toHaveBeenCalledTimes(6)
  })
  it("refreshes invalidated disk data even when hydration initially disabled the queries", async () => {
    await persist()
    sessionStorage.setItem(
      `showseek:history:v${HISTORY_SCHEMA_VERSION}:hook-user:lists:invalidated`,
      "1",
    )
    const hook = renderHook(() => useHistory(genres), { wrapper })
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(hook.result.current.fetching).toBe(false))
    expect(fetcher).toHaveBeenCalledWith("hook-user", "lists")
  })
  it("keeps in-flight reads alive across navigation instead of starting another collection scan", async () => {
    let resolve!: (value: []) => void
    const pending = new Promise<[]>((done) => {
      resolve = done
    })
    fetcher.mockReturnValue(pending)
    const hook = renderHook(() => useHistory(genres), { wrapper })
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3))
    hook.unmount()
    const returning = renderHook(() => useHistory(genres, "2026-03"), {
      wrapper,
    })
    await act(async () => {
      resolve([])
    })
    await waitFor(() => expect(returning.result.current.loading).toBe(false))
    expect(fetcher).toHaveBeenCalledTimes(3)
  })
  it("refetches only a mutated collection and never shows data after account changes", async () => {
    const hook = renderHook(() => useHistory(genres), { wrapper })
    await waitFor(() => expect(hook.result.current.loading).toBe(false))
    await act(async () => {
      await client.invalidateQueries({
        queryKey: ["firestore", "lists", "hook-user"],
      })
    })
    expect(fetcher).toHaveBeenCalledTimes(4)
    auth.user = { uid: "another-user", isAnonymous: false }
    hook.rerender()
    expect(hook.result.current.overview).toBeUndefined()
    await waitFor(() =>
      expect(getHistoryCache(client).isReady("another-user")).toBe(true),
    )
    await waitFor(() => expect(hook.result.current.loading).toBe(false))
    expect(fetcher).toHaveBeenCalledTimes(7)
  })
})
