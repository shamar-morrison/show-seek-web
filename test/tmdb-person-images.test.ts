import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const fetchMock = vi.fn()
const originalFetch = global.fetch

describe("TMDB person images fetcher and server action", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv("TMDB_BEARER_TOKEN", "test-token")
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({
      json: async () => ({
        id: 999,
        profiles: [
          {
            aspect_ratio: 0.667,
            file_path: "/test.jpg",
            height: 1500,
            iso_639_1: null,
            vote_average: 5,
            vote_count: 10,
            width: 1000,
          },
        ],
      }),
      ok: true,
    })
    global.fetch = fetchMock as unknown as typeof fetch
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    global.fetch = originalFetch
  })

  it("calls /person/{id}/images with bearer token in getPersonImages", async () => {
    const { getPersonImages } = await import("@/lib/tmdb")

    const result = await getPersonImages(999)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    const requestUrl = new URL(url)

    expect(requestUrl.pathname).toBe("/3/person/999/images")
    expect(options.headers).toMatchObject({
      Authorization: "Bearer test-token",
    })
    expect(result?.profiles).toHaveLength(1)
    expect(result?.profiles[0].file_path).toBe("/test.jpg")
  })

  it("delegates to getPersonImages in fetchPersonImages server action", async () => {
    const { fetchPersonImages } = await import("@/app/server-actions/tmdb")

    const result = await fetchPersonImages(999)

    expect(result?.profiles).toHaveLength(1)
    expect(result?.profiles[0].file_path).toBe("/test.jpg")
  })

  it("returns null on API failure", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
    })
    const { getPersonImages } = await import("@/lib/tmdb")

    const result = await getPersonImages(999)
    expect(result).toBeNull()
  })
})
