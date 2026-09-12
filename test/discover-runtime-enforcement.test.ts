import type { TMDBDiscoverResponse, TMDBMedia } from "@/types/tmdb"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

function mediaItem(id: number): TMDBMedia {
  return {
    adult: false,
    backdrop_path: null,
    genre_ids: [],
    id,
    media_type: "movie",
    original_language: "en",
    overview: "",
    popularity: 10,
    poster_path: null,
    vote_average: 7,
    vote_count: 100,
  }
}

function discoverPage(ids: number[], totalPages = 1): TMDBDiscoverResponse {
  return {
    page: 1,
    results: ids.map(mediaItem),
    total_pages: totalPages,
    total_results: ids.length * totalPages,
  }
}

describe("discoverMedia runtime enforcement", () => {
  const fetchMock = vi.fn()
  let discoverMedia: (typeof import("@/lib/tmdb"))["discoverMedia"]

  // id -> authoritative runtime (null = unknown). Absent id = 404.
  let movieRuntimes: Record<number, number | null> = {}
  let showRuntimes: Record<number, number | null> = {}
  let discoverPages: Record<number, TMDBDiscoverResponse> = {}

  beforeAll(async () => {
    // lib/tmdb reads the token once at module load, so stub it before import.
    vi.stubEnv("TMDB_BEARER_TOKEN", "test-token")
    vi.resetModules()
    ;({ discoverMedia } = await import("@/lib/tmdb"))
  })

  afterEach(() => {
    fetchMock.mockReset()
    vi.unstubAllGlobals()
    movieRuntimes = {}
    showRuntimes = {}
    discoverPages = {}
  })

  function mockFetch() {
    fetchMock.mockImplementation(async (url: unknown) => {
      const requestUrl = String(url)
      if (requestUrl.includes("/discover/")) {
        const page = Number(new URL(requestUrl).searchParams.get("page") ?? 1)
        const payload = discoverPages[page] ?? {
          page,
          results: [],
          total_pages: page,
          total_results: 0,
        }
        return {
          json: async () => JSON.parse(JSON.stringify(payload)),
          ok: true,
        }
      }
      const movieMatch = requestUrl.match(/\/movie\/(\d+)/)
      if (movieMatch) {
        const runtime = movieRuntimes[Number(movieMatch[1])]
        if (runtime === undefined) return { ok: false, status: 404 }
        return { json: async () => ({ runtime }), ok: true }
      }
      const tvMatch = requestUrl.match(/\/tv\/(\d+)/)
      if (tvMatch) {
        const runtime = showRuntimes[Number(tvMatch[1])]
        if (runtime === undefined) return { ok: false, status: 404 }
        return {
          json: async () => ({
            episode_run_time: runtime == null ? [] : [runtime],
          }),
          ok: true,
        }
      }
      throw new Error(`Unexpected fetch: ${requestUrl}`)
    })
    vi.stubGlobal("fetch", fetchMock)
  }

  function discoverCalls(): string[] {
    return fetchMock.mock.calls
      .map(([url]) => String(url))
      .filter((url) => url.includes("/discover/"))
  }

  function detailCalls(): string[] {
    return fetchMock.mock.calls
      .map(([url]) => String(url))
      .filter((url) => !url.includes("/discover/"))
  }

  it("keeps only titles whose authoritative runtime is in range", async () => {
    discoverPages = { 1: discoverPage([1, 2, 3, 4, 5]) }
    // 179 out, 215 in (boundary), null unknown, 240 in (boundary), 241 out.
    movieRuntimes = { 1: 179, 2: 215, 3: null, 4: 240, 5: 241 }
    mockFetch()

    const data = await discoverMedia({
      mediaType: "movie",
      runtimeGte: 215,
      runtimeLte: 240,
    })

    expect(data.results.map((item) => item.id)).toEqual([2, 4])
    // The coarse with_runtime pre-filter is still sent to TMDB.
    const params = new URL(discoverCalls()[0]).searchParams
    expect(params.get("with_runtime.gte")).toBe("215")
    expect(params.get("with_runtime.lte")).toBe("240")
  })

  it("backfills from later pages when the first page filters out", async () => {
    discoverPages = {
      1: discoverPage([1, 2], 3),
      2: discoverPage([3, 4], 3),
    }
    movieRuntimes = { 1: 100, 2: 120, 3: 220, 4: 230 }
    mockFetch()

    const data = await discoverMedia({
      mediaType: "movie",
      runtimeGte: 215,
      runtimeLte: 240,
    })

    expect(data.results.map((item) => item.id)).toEqual([3, 4])
    expect(
      discoverCalls().some(
        (url) => new URL(url).searchParams.get("page") === "2",
      ),
    ).toBe(true)
  })

  it("stops scanning after the backfill cap", async () => {
    discoverPages = { 1: discoverPage([1], 500) }
    movieRuntimes = { 1: 100 }
    mockFetch()

    const data = await discoverMedia({
      mediaType: "movie",
      runtimeGte: 215,
      runtimeLte: 240,
    })

    expect(data.results).toEqual([])
    // First page + bounded extras, never the full 500 pages.
    expect(discoverCalls().length).toBeLessThanOrEqual(5)
  })

  it("makes no detail calls without runtime params", async () => {
    discoverPages = { 1: discoverPage([1, 2]) }
    mockFetch()

    const data = await discoverMedia({ mediaType: "movie" })

    expect(data.results.map((item) => item.id)).toEqual([1, 2])
    expect(detailCalls()).toEqual([])
    const params = new URL(discoverCalls()[0]).searchParams
    expect(params.get("with_runtime.gte")).toBeNull()
    expect(params.get("with_runtime.lte")).toBeNull()
  })

  it("uses episode runtime for TV shows", async () => {
    discoverPages = {
      1: {
        page: 1,
        results: [{ ...mediaItem(11), media_type: "tv" }],
        total_pages: 1,
        total_results: 1,
      },
    }
    showRuntimes = { 11: 60 }
    mockFetch()

    const data = await discoverMedia({
      mediaType: "tv",
      runtimeGte: 45,
      runtimeLte: 75,
    })

    expect(data.results.map((item) => item.id)).toEqual([11])
    expect(detailCalls().some((url) => url.includes("/tv/11"))).toBe(true)
  })

  it("uses lightweight runtime lookups without credits payloads", async () => {
    discoverPages = { 1: discoverPage([1, 2]) }
    movieRuntimes = { 1: 220, 2: 230 }
    mockFetch()

    await discoverMedia({
      mediaType: "movie",
      runtimeGte: 215,
      runtimeLte: 240,
    })

    const details = detailCalls()
    expect(details).toHaveLength(2)
    for (const url of details) {
      expect(url).not.toContain("append_to_response")
    }
  })

  it("preserves TMDB totals from the first page", async () => {
    discoverPages = { 1: discoverPage([1, 2], 9) }
    movieRuntimes = { 1: 100, 2: 220 }
    mockFetch()

    const data = await discoverMedia({
      mediaType: "movie",
      runtimeGte: 215,
      runtimeLte: 240,
    })

    expect(data.results.map((item) => item.id)).toEqual([2])
    expect(data.total_pages).toBe(9)
  })
})
