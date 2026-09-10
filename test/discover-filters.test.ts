import { parseGenreOperator, parseIntList } from "@/lib/utils"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

describe("parseIntList", () => {
  it("parses single values for backwards compatibility", () => {
    expect(parseIntList("28")).toEqual([28])
  })

  it("parses comma-separated values", () => {
    expect(parseIntList("28,12,16")).toEqual([28, 12, 16])
  })

  it("parses repeated-param arrays", () => {
    expect(parseIntList(["28", "12"])).toEqual([28, 12])
  })

  it("drops invalid entries and handles empty input", () => {
    expect(parseIntList("28,abc,12")).toEqual([28, 12])
    expect(parseIntList("")).toEqual([])
    expect(parseIntList(undefined)).toEqual([])
    expect(parseIntList(null)).toEqual([])
  })
})

describe("parseGenreOperator", () => {
  it("defaults to OR unless explicitly AND", () => {
    expect(parseGenreOperator(undefined)).toBe("or")
    expect(parseGenreOperator("or")).toBe("or")
    expect(parseGenreOperator("and")).toBe("and")
    expect(parseGenreOperator("invalid")).toBe("or")
  })
})

describe("discoverMedia genre/provider params", () => {
  const fetchMock = vi.fn()
  let discoverMedia: typeof import("@/lib/tmdb")["discoverMedia"]

  beforeAll(async () => {
    // lib/tmdb reads the token once at module load, so stub it before import.
    vi.stubEnv("TMDB_BEARER_TOKEN", "test-token")
    vi.resetModules()
    ;({ discoverMedia } = await import("@/lib/tmdb"))
  })

  afterEach(() => {
    fetchMock.mockReset()
    vi.unstubAllGlobals()
  })

  function mockFetch() {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ page: 1, results: [], total_pages: 0, total_results: 0 }),
    })
    vi.stubGlobal("fetch", fetchMock)
  }

  function lastQueryParams(): URLSearchParams {
    const url = String(fetchMock.mock.calls[0]?.[0] ?? "")
    return new URL(url).searchParams
  }

  it("joins multiple genres with | for OR (default)", async () => {
    mockFetch()

    await discoverMedia({
      mediaType: "movie",
      genres: [28, 12],
      genreOperator: "or",
    })

    expect(lastQueryParams().get("with_genres")).toBe("28|12")
  })

  it("joins multiple genres with , for AND", async () => {
    mockFetch()

    await discoverMedia({
      mediaType: "movie",
      genres: [28, 12],
      genreOperator: "and",
    })

    expect(lastQueryParams().get("with_genres")).toBe("28,12")
  })

  it("keeps the legacy single genre param working", async () => {
    mockFetch()

    await discoverMedia({ mediaType: "movie", genre: 28 })

    expect(lastQueryParams().get("with_genres")).toBe("28")
  })

  it("always joins providers with | (OR-only)", async () => {
    mockFetch()

    await discoverMedia({ mediaType: "movie", providers: [8, 15] })

    const params = lastQueryParams()
    expect(params.get("with_watch_providers")).toBe("8|15")
    expect(params.get("watch_region")).toBe("US")
  })
})
