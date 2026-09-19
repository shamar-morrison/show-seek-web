import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

// unstable_cache is a Next runtime API: pass through so unit tests exercise
// the real fetch/parse logic. (Throw-on-failure is what keeps misses out of
// the real cache in production.)
vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...args: never[]) => unknown) => fn,
}))

const mocks = vi.hoisted(() => ({
  tmdbFetch: vi.fn(),
}))

vi.mock("@/lib/tmdb", () => ({
  tmdbFetch: mocks.tmdbFetch,
}))

describe("OMDb external ratings helper", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("returns IMDb, Rotten Tomatoes, and Metacritic ratings when all are available", async () => {
    vi.stubEnv("OMDB_API_KEY", "test-omdb-key")
    mocks.tmdbFetch.mockResolvedValue({
      json: vi.fn(async () => ({ imdb_id: "tt0133093" })),
      ok: true,
    })

    const fetchMock = vi.fn(
      async (_input: string | URL | Request, _init?: RequestInit) =>
        new Response(
          JSON.stringify({
            Response: "True",
            Ratings: [
              { Source: "Rotten Tomatoes", Value: "83%" },
              { Source: "Metacritic", Value: "73/100" },
            ],
            imdbRating: "8.7",
            imdbVotes: "2,123,456",
          }),
          { status: 200 },
        ),
    )
    vi.stubGlobal("fetch", fetchMock)

    const { getMediaExternalRatings } = await import("@/lib/omdb")
    const result = await getMediaExternalRatings("movie", 603)

    expect(result).toEqual({
      imdb: { rating: "8.7", votes: "2,123,456" },
      rottenTomatoes: "83%",
      metacritic: "73/100",
    })
    expect(mocks.tmdbFetch).toHaveBeenCalledWith("/movie/603/external_ids", {
      next: { revalidate: 86400 },
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const firstFetchCall = fetchMock.mock.calls[0]
    expect(firstFetchCall).toBeDefined()

    if (!firstFetchCall) {
      throw new Error("Expected OMDb fetch call")
    }

    const [requestedUrl, requestInit] = firstFetchCall

    // Failures must bypass the cache so a miss is retried, not frozen.
    expect(requestInit?.cache).toBe("no-store")
    expect(requestInit?.next).toBeUndefined()
    expect(requestInit?.signal).toBeInstanceOf(AbortSignal)
    expect(requestedUrl).toBeInstanceOf(URL)

    if (!(requestedUrl instanceof URL)) {
      throw new Error("Expected OMDb fetch to receive a URL")
    }

    expect(requestedUrl.searchParams.get("apikey")).toBe("test-omdb-key")
    expect(requestedUrl.searchParams.get("i")).toBe("tt0133093")
  })

  it("returns null without calling TMDB or OMDb when OMDb is unconfigured", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const { getMediaExternalRatings } = await import("@/lib/omdb")
    const result = await getMediaExternalRatings("movie", 603)

    expect(result).toBeNull()
    expect(mocks.tmdbFetch).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("returns null when TMDB has no IMDb ID for the media item", async () => {
    vi.stubEnv("OMDB_API_KEY", "test-omdb-key")
    mocks.tmdbFetch.mockResolvedValue({
      json: vi.fn(async () => ({ imdb_id: null })),
      ok: true,
    })

    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const { getMediaExternalRatings } = await import("@/lib/omdb")
    const result = await getMediaExternalRatings("tv", 1399)

    expect(result).toBeNull()
    expect(mocks.tmdbFetch).toHaveBeenCalledWith("/tv/1399/external_ids", {
      next: { revalidate: 86400 },
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("returns null when OMDb responds with an API error", async () => {
    vi.stubEnv("OMDB_API_KEY", "test-omdb-key")
    mocks.tmdbFetch.mockResolvedValue({
      json: vi.fn(async () => ({ imdb_id: "tt0944947" })),
      ok: true,
    })
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            Response: "False",
            Error: "Movie not found!",
          }),
          { status: 200 },
        ),
      ),
    )

    const { getMediaExternalRatings } = await import("@/lib/omdb")

    await expect(getMediaExternalRatings("tv", 1399)).resolves.toBeNull()
  })

  it("returns null when OMDb has no usable ratings values", async () => {
    vi.stubEnv("OMDB_API_KEY", "test-omdb-key")
    mocks.tmdbFetch.mockResolvedValue({
      json: vi.fn(async () => ({ imdb_id: "tt0108778" })),
      ok: true,
    })
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            Response: "True",
            Ratings: [],
            imdbRating: "N/A",
            imdbVotes: "N/A",
          }),
          { status: 200 },
        ),
      ),
    )

    const { getMediaExternalRatings } = await import("@/lib/omdb")

    await expect(getMediaExternalRatings("movie", 11104)).resolves.toBeNull()
  })

  it("returns null without caching when OMDb reports a rate limit", async () => {
    vi.stubEnv("OMDB_API_KEY", "test-omdb-key")
    mocks.tmdbFetch.mockResolvedValue({
      json: vi.fn(async () => ({ imdb_id: "tt0101507" })),
      ok: true,
    })
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            Response: "False",
            Error: "Request limit reached!",
          }),
          { status: 200 },
        ),
      ),
    )

    const { getMediaExternalRatings } = await import("@/lib/omdb")

    await expect(getMediaExternalRatings("movie", 782)).resolves.toBeNull()
  })

  it("retries after a failure instead of serving a cached miss", async () => {
    vi.stubEnv("OMDB_API_KEY", "test-omdb-key")
    mocks.tmdbFetch.mockResolvedValue({
      json: vi.fn(async () => ({ imdb_id: "tt0101507" })),
      ok: true,
    })
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          Response: "False",
          Error: "Request limit reached!",
        }),
        { status: 200 },
      ),
    )
    vi.stubGlobal("fetch", fetchMock)

    const { getMediaExternalRatings } = await import("@/lib/omdb")

    await expect(getMediaExternalRatings("movie", 782)).resolves.toBeNull()

    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          Response: "True",
          Ratings: [{ Source: "Rotten Tomatoes", Value: "93%" }],
          imdbRating: "7.8",
          imdbVotes: "350,000",
        }),
        { status: 200 },
      ),
    )

    await expect(getMediaExternalRatings("movie", 782)).resolves.toEqual({
      imdb: { rating: "7.8", votes: "350,000" },
      rottenTomatoes: "93%",
      metacritic: null,
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("returns null when the OMDb request is aborted by the timeout", async () => {
    vi.useFakeTimers()
    vi.stubEnv("OMDB_API_KEY", "test-omdb-key")
    mocks.tmdbFetch.mockResolvedValue({
      json: vi.fn(async () => ({ imdb_id: "tt0133093" })),
      ok: true,
    })

    const fetchMock = vi.fn(
      (_input: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted.", "AbortError"))
          })
        }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const { getMediaExternalRatings } = await import("@/lib/omdb")
    const resultPromise = getMediaExternalRatings("movie", 603)

    await vi.advanceTimersByTimeAsync(10_000)

    await expect(resultPromise).resolves.toBeNull()
  })
})
