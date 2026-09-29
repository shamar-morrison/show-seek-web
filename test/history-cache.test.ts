import { IDBFactory } from "fake-indexeddb"
import { QueryClient } from "@tanstack/react-query"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  getHistoryCache,
  HistoryCache,
  HistoryDeferredError,
} from "@/lib/history/cache"
import {
  createHistoryStorage,
  HISTORY_SCHEMA_VERSION,
  type HistoryRecord,
} from "@/lib/history/storage"
import {
  HISTORY_ATTEMPT_MS,
  HISTORY_FRESH_MS,
  HISTORY_RETAIN_MS,
  historyKey,
} from "@/lib/history/keys"
import type { HistorySource } from "@/lib/history/calculator"

const NOW = new Date(2026, 2, 9, 12).getTime()
const uid = "history-test"
const diskKey = (kind = "lists", user = uid) =>
  `showseek:history:v${HISTORY_SCHEMA_VERSION}:${user}:${kind}`
const lists: HistorySource["lists"] = [
  { id: "already-watched", name: "Watched", createdAt: NOW, items: {} },
]
const clients: QueryClient[] = []
function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  })
  clients.push(client)
  return { client, cache: getHistoryCache(client) }
}
function read(
  client: QueryClient,
  cache: HistoryCache,
  fetcher: () => Promise<HistorySource["lists"]>,
  user = uid,
) {
  return client.fetchQuery({
    queryKey: historyKey(user, "lists"),
    staleTime: HISTORY_FRESH_MS,
    queryFn: () =>
      cache.fetch(user, "lists", fetcher, new AbortController().signal),
  })
}
async function seed(record: Partial<HistoryRecord> = {}) {
  await createHistoryStorage().put(diskKey(), {
    version: HISTORY_SCHEMA_VERSION,
    updatedAt: NOW,
    data: lists,
    ...record,
  })
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(NOW)
  vi.stubGlobal("indexedDB", new IDBFactory())
  sessionStorage.clear()
})
afterEach(() => {
  clients.forEach((client) => client.clear())
  clients.length = 0
  vi.useRealTimers()
})

describe("reload-safe history caching", () => {
  it("restores IDB into a new QueryClient without reads or resetting fetch time", async () => {
    const first = setup()
    await first.cache.selectUser(uid)
    const fetcher = vi.fn(async () => lists)
    await read(first.client, first.cache, fetcher)
    vi.setSystemTime(NOW + 120_000)
    const reload = setup()
    await reload.cache.selectUser(uid)
    for (let i = 0; i < 20; i++)
      expect(await read(reload.client, reload.cache, fetcher)).toEqual(lists)
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(
      reload.client.getQueryState(historyKey(uid, "lists"))?.dataUpdatedAt,
    ).toBe(NOW)
    expect((await createHistoryStorage().get(diskKey()))?.updatedAt).toBe(NOW)
  })
  it("refreshes stale data once and shares concurrent requests", async () => {
    await seed()
    vi.setSystemTime(NOW + HISTORY_FRESH_MS)
    const { client, cache } = setup()
    await cache.selectUser(uid)
    const fetcher = vi.fn(async () => lists)
    await Promise.all(
      Array.from({ length: 15 }, () => read(client, cache, fetcher)),
    )
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(client.getQueryState(historyKey(uid, "lists"))?.dataUpdatedAt).toBe(
      NOW + HISTORY_FRESH_MS,
    )
  })
  it("persists the attempt before a billable read and blocks reloads during an unfinished request", async () => {
    const first = setup()
    await first.cache.selectUser(uid)
    let resolve!: (data: typeof lists) => void
    const fetcher = vi.fn(
      () =>
        new Promise<typeof lists>((done) => {
          resolve = done
        }),
    )
    const pending = read(first.client, first.cache, fetcher)
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1))
    const attemptAt = (await createHistoryStorage().get(diskKey()))?.attemptAt
    expect(attemptAt).toBeGreaterThanOrEqual(NOW)
    const reload = setup()
    await reload.cache.selectUser(uid)
    const otherFetch = vi.fn(async () => lists)
    await expect(
      read(reload.client, reload.cache, otherFetch),
    ).rejects.toMatchObject({ retryAt: attemptAt! + HISTORY_ATTEMPT_MS })
    expect(otherFetch).not.toHaveBeenCalled()
    resolve(lists)
    await pending
    expect(
      (await createHistoryStorage().get(diskKey()))?.attemptAt,
    ).toBeUndefined()
  })
  it("recovers automatically eligible reads after an interrupted attempt expires", async () => {
    await seed({ data: undefined, updatedAt: 0, attemptAt: NOW })
    const { client, cache } = setup()
    await cache.selectUser(uid)
    const fetcher = vi.fn(async () => lists)
    await expect(read(client, cache, fetcher)).rejects.toBeInstanceOf(
      HistoryDeferredError,
    )
    vi.setSystemTime(NOW + HISTORY_ATTEMPT_MS)
    expect(await read(client, cache, fetcher)).toEqual(lists)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
  it("persists manual cooldown across reloads and starts it after automatic refresh too", async () => {
    const first = setup()
    await first.cache.selectUser(uid)
    await read(first.client, first.cache, async () => lists)
    expect(first.cache.beginManualRefresh()).toBe(false)
    vi.setSystemTime(NOW + HISTORY_ATTEMPT_MS)
    expect(first.cache.beginManualRefresh()).toBe(true)
    const reload = setup()
    await reload.cache.selectUser(uid)
    expect(reload.cache.beginManualRefresh()).toBe(false)
    expect(reload.cache.manualAvailableAt()).toBe(NOW + 2 * HISTORY_ATTEMPT_MS)
  })
  it("invalidates disk even when history has never mounted and reloads before IDB invalidation commits", async () => {
    await seed()
    const first = setup()
    await first.cache.selectUser(uid)
    // Emulate memory GC, then a mutation elsewhere in the app.
    first.client.removeQueries({
      queryKey: historyKey(uid, "lists"),
      exact: true,
    })
    void first.client.invalidateQueries({
      queryKey: ["firestore", "lists", uid],
    })
    const reload = setup()
    await reload.cache.selectUser(uid)
    expect(reload.cache.needsRefresh(uid, "lists")).toBe(true)
    const fetcher = vi.fn(async () => lists)
    await read(reload.client, reload.cache, fetcher)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
  it("does not invalidate unrelated users or collections", async () => {
    await seed()
    const { client, cache } = setup()
    await cache.selectUser(uid)
    await client.invalidateQueries({ queryKey: ["firestore", "ratings", uid] })
    await client.invalidateQueries({
      queryKey: ["firestore", "lists", "someone-else"],
    })
    expect(cache.needsRefresh(uid, "lists")).toBe(false)
  })
  it("does not let an older in-flight response overwrite a mutation invalidation", async () => {
    const { client, cache } = setup()
    await cache.selectUser(uid)
    let resolve!: (data: typeof lists) => void
    const fetcher = vi.fn(
      () =>
        new Promise<typeof lists>((done) => {
          resolve = done
        }),
    )
    const pending = read(client, cache, fetcher)
    const rejection =
      expect(pending).rejects.toBeInstanceOf(HistoryDeferredError)
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1))
    await client.invalidateQueries({
      queryKey: ["firestore", "lists", uid],
      refetchType: "none",
    })
    resolve(lists)
    await rejection
    expect(cache.needsRefresh(uid, "lists")).toBe(true)
    expect((await createHistoryStorage().get(diskKey()))?.invalidated).toBe(
      true,
    )
  })
  it("keeps successful timestamps on failure, retries once, and persists retry cooldown", async () => {
    await seed()
    vi.setSystemTime(NOW + HISTORY_FRESH_MS)
    const first = setup()
    await first.cache.selectUser(uid)
    const fetcher = vi.fn(async () => {
      throw new Error("offline")
    })
    await expect(read(first.client, first.cache, fetcher)).rejects.toThrow(
      "offline",
    )
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(first.client.getQueryData(historyKey(uid, "lists"))).toEqual(lists)
    expect((await createHistoryStorage().get(diskKey()))?.updatedAt).toBe(NOW)
    const reload = setup()
    await reload.cache.selectUser(uid)
    await expect(
      read(reload.client, reload.cache, fetcher),
    ).rejects.toBeInstanceOf(HistoryDeferredError)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
  it("does not retry denied reads", async () => {
    const { client, cache } = setup()
    await cache.selectUser(uid)
    const fetcher = vi.fn(async () => {
      throw Object.assign(new Error("denied"), { code: "permission-denied" })
    })
    await expect(read(client, cache, fetcher)).rejects.toThrow("denied")
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
  it.each([
    { updatedAt: NOW - HISTORY_RETAIN_MS },
    { version: 0 },
    { updatedAt: NOW + 1 },
  ])("discards expired or incompatible records: %j", async (record) => {
    await seed(record)
    const { client, cache } = setup()
    await cache.selectUser(uid)
    expect(client.getQueryData(historyKey(uid, "lists"))).toBeUndefined()
    const fetcher = vi.fn(async () => lists)
    await read(client, cache, fetcher)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
  it("clears records and query data on sign-out and never restores another account", async () => {
    await seed()
    const { client, cache } = setup()
    await cache.selectUser(uid)
    expect(client.getQueryData(historyKey(uid, "lists"))).toEqual(lists)
    await cache.selectUser(null)
    await cache.selectUser("other")
    expect(client.getQueryData(historyKey(uid, "lists"))).toBeUndefined()
    expect(await createHistoryStorage().get(diskKey())).toBeUndefined()
    expect(client.getQueryData(historyKey("other", "lists"))).toBeUndefined()
  })
  it("rejects late results after account change", async () => {
    const { client, cache } = setup()
    await cache.selectUser(uid)
    let resolve!: (data: typeof lists) => void
    const fetcher = vi.fn(
      () =>
        new Promise<typeof lists>((done) => {
          resolve = done
        }),
    )
    const pending = read(client, cache, fetcher).catch(() => null)
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1))
    await cache.selectUser("other")
    resolve(lists)
    await pending
    expect(await createHistoryStorage().get(diskKey())).toBeUndefined()
    expect(client.getQueryData(historyKey(uid, "lists"))).toBeUndefined()
  })
  it("falls back to memory once when browser storage fails", async () => {
    const open = vi.fn(() => {
      throw new Error("blocked")
    })
    vi.stubGlobal("indexedDB", { open })
    const storage = createHistoryStorage()
    await storage.put("x", {
      version: HISTORY_SCHEMA_VERSION,
      updatedAt: NOW,
      data: lists,
    })
    expect((await storage.get("x"))?.data).toEqual(lists)
    await storage.remove("x")
    expect(await storage.get("x")).toBeUndefined()
    expect(open).toHaveBeenCalledTimes(1)
  })
})
