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

  it("caches the hero day+week pool for 24 hours without changing regular trending", async () => {
    const fetchMock = vi.fn(
      async (_input: string | URL | Request, _init?: RequestInit) =>
        new Response(JSON.stringify({ results: [] }), { status: 200 }),
    )
    vi.stubGlobal("fetch", fetchMock)
    vi.spyOn(console, "error").mockImplementation(() => undefined)

    const { getHeroMediaList, getTrendingMedia } = await import("@/lib/tmdb")

    await getHeroMediaList(2)
    await getTrendingMedia("day")

    expect(fetchMock).toHaveBeenCalledTimes(3)

    const [heroDayUrl, heroDayOptions] = fetchMock.mock.calls[0] as [
      string,
      { next?: { revalidate?: number } },
    ]
    const [heroWeekUrl, heroWeekOptions] = fetchMock.mock.calls[1] as [
      string,
      { next?: { revalidate?: number } },
    ]
    const [trendingUrl, trendingOptions] = fetchMock.mock.calls[2] as [
      string,
      { next?: { revalidate?: number } },
    ]

    expect(new URL(heroDayUrl.toString()).pathname).toContain(
      "/trending/all/day",
    )
    expect(new URL(heroWeekUrl.toString()).pathname).toContain(
      "/trending/all/week",
    )
    expect(new URL(heroDayUrl.toString()).searchParams.get("language")).toBe(
      "en-US",
    )
    expect(new URL(heroWeekUrl.toString()).searchParams.get("language")).toBe(
      "en-US",
    )
    expect(heroDayOptions?.next).toEqual({ revalidate: 86_400 })
    expect(heroWeekOptions?.next).toEqual({ revalidate: 86_400 })
    expect(new URL(trendingUrl.toString()).searchParams.get("language")).toBeNull()
    expect(trendingOptions?.next).toEqual({ revalidate: 3600 })
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

      if (url.pathname.endsWith("/trending/all/week")) {
        return new Response(JSON.stringify({ results: [] }), { status: 200 })
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

  it("rotates the hero window daily with wrap-around", async () => {
    const { getHeroRotationSlice } = await import("@/lib/tmdb")

    const pool = [1, 2, 3, 4, 5, 6]
    const dayMs = 86_400_000
    const dayZero = dayMs * 10

    expect(getHeroRotationSlice(pool, 2, dayZero)).toEqual([3, 4])
    expect(getHeroRotationSlice(pool, 2, dayZero + dayMs)).toEqual([5, 6])
    // Wraps around the end of the pool
    expect(getHeroRotationSlice(pool, 2, dayZero + dayMs * 2)).toEqual([1, 2])
  })

  it("dedupes day and week trending into one rotation pool", async () => {
    const dayResults = [
      {
        id: 1,
        media_type: "movie",
        title: "Day One",
        overview: "Day one overview.",
        backdrop_path: "/one.jpg",
        release_date: "2026-01-01",
        vote_average: 7,
      },
      {
        id: 2,
        media_type: "tv",
        name: "Day Two",
        overview: "Day two overview.",
        backdrop_path: "/two.jpg",
        first_air_date: "2026-02-01",
        vote_average: 8,
      },
    ]
    const weekResults = [
      {
        id: 1,
        media_type: "movie",
        title: "Day One",
        overview: "Day one overview.",
        backdrop_path: "/one.jpg",
        release_date: "2026-01-01",
        vote_average: 7,
      },
      {
        id: 3,
        media_type: "movie",
        title: "Week Three",
        overview: "Week three overview.",
        backdrop_path: "/three.jpg",
        release_date: "2026-03-01",
        vote_average: 9,
      },
    ]
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(input.toString())
      if (url.pathname.endsWith("/trending/all/day")) {
        return new Response(JSON.stringify({ results: dayResults }), {
          status: 200,
        })
      }
      if (url.pathname.endsWith("/trending/all/week")) {
        return new Response(JSON.stringify({ results: weekResults }), {
          status: 200,
        })
      }
      if (url.pathname.includes("/images")) {
        return new Response(JSON.stringify({ logos: [] }), { status: 200 })
      }
      if (url.pathname.includes("/videos")) {
        return new Response(JSON.stringify({ results: [] }), { status: 200 })
      }
      throw new Error(`Unexpected TMDB request: ${url.pathname}`)
    })
    vi.stubGlobal("fetch", fetchMock)
    vi.spyOn(console, "error").mockImplementation(() => undefined)

    const { getHeroMediaList } = await import("@/lib/tmdb")

    const hero = await getHeroMediaList(5)
    expect(hero.map((item) => item.id).sort()).toEqual([1, 2, 3])
  })
})
