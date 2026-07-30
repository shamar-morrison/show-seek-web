import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  cachedResults: new Map<string, Promise<unknown>>(),
  cachedInvocationArgs: [] as unknown[][],
  unstableCache: vi.fn(
    <Args extends unknown[], Result>(
      callback: (...args: Args) => Promise<Result>,
    ) =>
      async (...args: Args): Promise<Result> => {
        mocks.cachedInvocationArgs.push(args)
        const cacheKey = JSON.stringify(args)
        const cachedResult = mocks.cachedResults.get(cacheKey)

        if (cachedResult) {
          return cachedResult as Promise<Result>
        }

        const result = callback(...args)
        mocks.cachedResults.set(cacheKey, result)
        return result
      },
  ),
}))

vi.mock("next/cache", () => ({
  unstable_cache: mocks.unstableCache,
}))

describe("hero media cache", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mocks.cachedResults.clear()
    mocks.cachedInvocationArgs.length = 0
    vi.stubEnv("TMDB_BEARER_TOKEN", "test-token")
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("caches hero lists for 72 hours and keys entries by requested count", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ results: [] }), { status: 200 }),
    )
    vi.stubGlobal("fetch", fetchMock)

    const { getHeroMediaList } = await import("@/lib/tmdb")

    await getHeroMediaList(2)
    await getHeroMediaList(2)
    await getHeroMediaList(4)

    expect(mocks.unstableCache).toHaveBeenCalledWith(
      expect.any(Function),
      ["hero-media-list-v1"],
      { revalidate: 259_200 },
    )
    expect(mocks.cachedInvocationArgs).toEqual([[2], [2], [4]])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("builds the cached hero payload with trending metadata, logos, and trailers", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(input.toString())

      if (url.pathname.endsWith("/trending/all/day")) {
        return new Response(
          JSON.stringify({
            results: [
              {
                id: 123,
                media_type: "movie",
                title: "Example Movie",
                original_title: "Example Movie Original",
                overview: "A cached hero movie.",
                backdrop_path: "/backdrop.jpg",
                release_date: "2026-07-01",
                vote_average: 8.76,
              },
            ],
          }),
          { status: 200 },
        )
      }

      if (url.pathname.endsWith("/movie/123/images")) {
        return new Response(
          JSON.stringify({
            logos: [{ iso_639_1: "en", file_path: "/logo.png" }],
          }),
          { status: 200 },
        )
      }

      if (url.pathname.endsWith("/movie/123/videos")) {
        return new Response(
          JSON.stringify({
            results: [
              {
                site: "YouTube",
                key: "trailer-key",
                type: "Trailer",
                official: true,
              },
            ],
          }),
          { status: 200 },
        )
      }

      throw new Error(`Unexpected TMDB request: ${url.pathname}`)
    })
    vi.stubGlobal("fetch", fetchMock)

    const { getHeroMediaList } = await import("@/lib/tmdb")

    await expect(getHeroMediaList(1)).resolves.toEqual([
      {
        id: 123,
        title: "Example Movie",
        originalTitle: "Example Movie Original",
        overview: "A cached hero movie.",
        backdropUrl: "https://image.tmdb.org/t/p/original/backdrop.jpg",
        logoUrl: "https://image.tmdb.org/t/p/w500/logo.png",
        isDarkLogo: false,
        mediaType: "movie",
        releaseYear: "2026",
        voteAverage: 8.8,
        trailerKey: "trailer-key",
      },
    ])
  })
})
