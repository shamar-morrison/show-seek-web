import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const putMock = vi.fn(async (): Promise<any> => {})
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getMock = vi.fn(async (): Promise<any> => null)
const deleteMock = vi.fn(async () => {})

vi.mock("@opennextjs/cloudflare/cloudflare-context", () => ({
  getCloudflareContext: () => ({
    env: {
      NEXT_INC_CACHE_KV: {
        get: getMock,
        put: putMock,
        delete: deleteMock,
      },
    },
  }),
}))

const TEST_BUILD_ID = "TESTBUILDID-k"

describe("kv incremental cache with TTL", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env.OPEN_NEXT_BUILD_ID = TEST_BUILD_ID
  })

  it("writes entries with a 60-day expirationTtl", async () => {
    const cache = (
      await import("../overrides/kv-incremental-cache-with-ttl")
    ).default

    await cache.set(
      "some-fetch-key",
      { kind: "FETCH", data: "x" },
      "fetch",
    )

    expect(putMock).toHaveBeenCalledTimes(1)
    const [key, rawValue, options] = putMock.mock.calls[0] as unknown as [
      string,
      string,
      { expirationTtl?: number },
    ]
    // Same key format as the adapter: incremental-cache/<buildId>/<sha256>.fetch
    expect(key).toMatch(
      new RegExp(`^incremental-cache/${TEST_BUILD_ID}/[0-9a-f]{64}\\.fetch$`),
    )
    expect(JSON.parse(rawValue)).toMatchObject({
      value: { kind: "FETCH", data: "x" },
    })
    expect(typeof JSON.parse(rawValue).lastModified).toBe("number")
    expect(options).toEqual({ expirationTtl: 5_184_000 })
  })

  it("applies the TTL to route/page (.cache) entries too", async () => {
    const cache = (
      await import("../overrides/kv-incremental-cache-with-ttl")
    ).default

    await cache.set("some-page-key", { type: "app", html: "<x/>" }, "cache")

    const [key, , options] = putMock.mock.calls[0] as unknown as [
      string,
      string,
      { expirationTtl?: number },
    ]
    expect(key).toMatch(/\.cache$/)
    expect(options).toEqual({ expirationTtl: 5_184_000 })
  })

  it("returns null on a cache miss and passes runtime entries through", async () => {
    const cache = (
      await import("../overrides/kv-incremental-cache-with-ttl")
    ).default

    getMock.mockResolvedValueOnce(null)
    await expect(cache.get("missing", "fetch")).resolves.toBeNull()

    const stored = { value: { kind: "FETCH" }, lastModified: 123 }
    getMock.mockResolvedValueOnce(stored)
    await expect(cache.get("present", "fetch")).resolves.toEqual(stored)
  })

  it("deletes via the .cache key", async () => {
    const cache = (
      await import("../overrides/kv-incremental-cache-with-ttl")
    ).default

    await cache.delete("some-page-key")

    expect(deleteMock).toHaveBeenCalledTimes(1)
    const [key] = deleteMock.mock.calls[0] as unknown as [string]
    expect(key).toMatch(
      new RegExp(`^incremental-cache/${TEST_BUILD_ID}/[0-9a-f]{64}\\.cache$`),
    )
  })
})
