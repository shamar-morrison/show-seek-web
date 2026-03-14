import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const fetchMock = vi.fn()
const originalFetch = global.fetch

describe("calendar-specific TMDB fetchers", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv("TMDB_BEARER_TOKEN", "test-token")
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({
      json: async () => ({ id: 1 }),
      ok: true,
    })
    global.fetch = fetchMock as unknown as typeof fetch
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    global.fetch = originalFetch
  })

  it("requests movie calendar details without credits", async () => {
    const { getMovieCalendarDetails } = await import("@/lib/tmdb")

    await getMovieCalendarDetails(123)

    expect(fetchMock).toHaveBeenCalledTimes(1)

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    const requestUrl = new URL(url)

    expect(requestUrl.pathname).toBe("/3/movie/123")
    expect(requestUrl.searchParams.get("append_to_response")).toBe("release_dates")
    expect(requestUrl.searchParams.get("append_to_response")).not.toContain("credits")
    expect(options.headers).toMatchObject({
      Authorization: "Bearer test-token",
    })
  })

  it("requests tv calendar details without credits", async () => {
    const { getTVCalendarDetails } = await import("@/lib/tmdb")

    await getTVCalendarDetails(456)

    expect(fetchMock).toHaveBeenCalledTimes(1)

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit]
    const requestUrl = new URL(url)

    expect(requestUrl.pathname).toBe("/3/tv/456")
    expect(requestUrl.searchParams.get("append_to_response")).toBe("content_ratings")
    expect(requestUrl.searchParams.get("append_to_response")).not.toContain("credits")
    expect(options.headers).toMatchObject({
      Authorization: "Bearer test-token",
    })
  })
})
