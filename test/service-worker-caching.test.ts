import { readFileSync } from "node:fs"
import { join } from "node:path"
import vm from "node:vm"
import { afterEach, describe, expect, it, vi } from "vitest"

interface FakeEvent {
  request: { mode: string; url: string }
  respondWith: (response: Promise<Response>) => void
  waitUntil: (promise: Promise<unknown>) => void
}

interface FakeCacheStorage {
  keys: () => Promise<string[]>
  delete: (key: string) => Promise<boolean>
}

function loadServiceWorker(sandbox: Record<string, unknown>) {
  const code = readFileSync(join(process.cwd(), "public", "sw.js"), "utf8")
  vm.runInNewContext(code, vm.createContext(sandbox))
}

function createHarness(options?: {
  fetchImpl?: (request: unknown) => Promise<Response>
  cacheKeys?: string[]
}) {
  const listeners = new Map<string, Array<(event: FakeEvent) => void>>()
  const deletedKeys: string[] = []
  const remainingKeys = new Set(options?.cacheKeys ?? [])
  const responded: Array<Promise<Response>> = []
  const waited: Array<Promise<unknown>> = []

  const fakeSelf = {
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn(() => Promise.resolve()) },
    addEventListener: vi.fn(
      (type: string, handler: (event: FakeEvent) => void) => {
        const list = listeners.get(type) ?? []
        list.push(handler)
        listeners.set(type, list)
      },
    ),
  }
  const fakeCaches: FakeCacheStorage = {
    keys: async () => [...remainingKeys],
    delete: async (key: string) => {
      deletedKeys.push(key)
      return remainingKeys.delete(key)
    },
  }
  const sandbox: Record<string, unknown> = {
    self: fakeSelf,
    caches: fakeCaches,
    fetch: options?.fetchImpl ?? (async () => new Response("ok")),
    Response: globalThis.Response,
    console,
  }
  loadServiceWorker(sandbox)

  const dispatch = (type: string, event: Omit<FakeEvent, "respondWith" | "waitUntil">) => {
    const full: FakeEvent = {
      ...event,
      respondWith: (response) => {
        responded.push(response)
      },
      waitUntil: (promise) => {
        waited.push(promise)
      },
    }
    for (const handler of listeners.get(type) ?? []) handler(full)
    return full
  }

  return { dispatch, responded, waited, deletedKeys, fakeSelf, listeners }
}

const navigate = (url = "https://show-seek.app/trending-tv") => ({
  request: { mode: "navigate", url },
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("service worker caching policy", () => {
  it("purges all legacy caches on activate, then claims clients", async () => {
    const harness = createHarness({
      cacheKeys: ["legacy-v1-pages", "legacy-v1-assets"],
    })

    harness.dispatch("activate", {
      request: { mode: "navigate", url: "https://show-seek.app/" },
    })

    await Promise.all(harness.waited)
    expect(harness.deletedKeys.sort()).toEqual([
      "legacy-v1-assets",
      "legacy-v1-pages",
    ])
    expect(harness.fakeSelf.clients.claim).toHaveBeenCalled()
  })

  it("passes a 500 navigation response through untouched and caches nothing", async () => {
    const serverError = new Response("worker exploded", { status: 500 })
    const harness = createHarness({
      fetchImpl: async () => serverError,
      cacheKeys: ["legacy-v1-pages"],
    })

    harness.dispatch("fetch", navigate())
    expect(harness.responded).toHaveLength(1)

    const response = await harness.responded[0]
    expect(response.status).toBe(500)
    expect(await response.text()).toBe("worker exploded")

    // Nothing may be written anywhere: the only cache interaction allowed
    // is the activate-time purge tested above.
    expect(harness.deletedKeys).toEqual([])
  })

  it("passes a 200 navigation response through untouched", async () => {
    const harness = createHarness({
      fetchImpl: async () => new Response("<html>ok</html>", { status: 200 }),
    })

    harness.dispatch("fetch", navigate())

    const response = await harness.responded[0]
    expect(response.status).toBe(200)
    expect(await response.text()).toBe("<html>ok</html>")
  })

  it("serves the offline page only when the network itself fails", async () => {
    const harness = createHarness({
      fetchImpl: async () => {
        throw new TypeError("fetch failed")
      },
    })

    harness.dispatch("fetch", navigate())

    const response = await harness.responded[0]
    expect(response.status).toBe(503)
    expect(response.headers.get("content-type")).toContain("text/html")
    expect(await response.text()).toContain("You're Offline")
  })

  it("does not intercept non-navigation requests", () => {
    const harness = createHarness()

    harness.dispatch("fetch", {
      request: { mode: "no-cors", url: "https://image.tmdb.org/t/p/w500/x.png" },
    })

    expect(harness.responded).toHaveLength(0)
  })
})
