import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

describe("hero media cache", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubEnv("TMDB_BEARER_TOKEN", "test-token")
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("caches the hero selection for 72 hours without changing regular trending", async () => {
    const fetchMock = vi.fn(
      async (_input: string | URL | Request, _init?: RequestInit) =>
        new Response(JSON.stringify({ results: [] }), { status: 200 }),
    )
    vi.stubGlobal("fetch", fetchMock)
    vi.spyOn(console, "error").mockImplementation(() => undefined)

    const { getHeroMediaList, getTrendingMedia } = await import("@/lib/tmdb")

    await getHeroMediaList(2)
    await getTrendingMedia("day")

    const heroCall = fetchMock.mock.calls[0]
    const trendingCall = fetchMock.mock.calls[1]

    if (!heroCall || !trendingCall) {
      throw new Error("Expected hero and regular trending requests")
    }

    const [heroUrl, heroOptions] = heroCall
    const [trendingUrl, trendingOptions] = trendingCall

    expect(new URL(heroUrl.toString()).searchParams.get("language")).toBe(
      "en-US",
    )
    expect(heroOptions?.next).toEqual({ revalidate: 259_200 })
    expect(new URL(trendingUrl.toString()).searchParams.get("language")).toBeNull()
    expect(trendingOptions?.next).toEqual({ revalidate: 3600 })
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
