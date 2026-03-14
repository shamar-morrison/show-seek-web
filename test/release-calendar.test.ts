import { describe, expect, it, vi } from "vitest"

import {
  buildReleaseCalendarSeasonRequests,
  buildReleaseCalendarReleases,
  dedupeTrackedItems,
  deriveReleaseCalendarReleases,
  resolveMovieReleaseDate,
} from "@/lib/release-calendar"
import {
  DEFAULT_REGION,
  isSupportedRegionCode,
  resolveUserRegion,
} from "@/lib/regions"
import type { TMDBMovieDetails, TMDBSeasonDetails, TMDBTVDetails } from "@/types/tmdb"
import type { FetchReleaseCalendarInput } from "@/types/release-calendar"

function createMovieDetails(
  overrides: Partial<TMDBMovieDetails> = {},
): TMDBMovieDetails {
  return {
    id: 1,
    title: "Movie",
    original_title: "Movie",
    original_language: "en",
    overview: "",
    poster_path: null,
    backdrop_path: null,
    release_date: "2026-01-01",
    runtime: null,
    vote_average: 0,
    vote_count: 0,
    genres: [],
    status: "Released",
    tagline: null,
    adult: false,
    budget: 0,
    homepage: null,
    imdb_id: null,
    revenue: 0,
    video: false,
    production_companies: [],
    production_countries: [],
    spoken_languages: [],
    belongs_to_collection: null,
    ...overrides,
  } as TMDBMovieDetails
}

function createTVDetails(overrides: Partial<TMDBTVDetails> = {}): TMDBTVDetails {
  return {
    id: 1,
    name: "TV Show",
    original_name: "TV Show",
    original_language: "en",
    overview: "",
    poster_path: null,
    backdrop_path: null,
    first_air_date: "2025-01-01",
    last_air_date: null,
    episode_run_time: [],
    vote_average: 0,
    vote_count: 0,
    genres: [],
    status: "Returning Series",
    tagline: null,
    number_of_seasons: 4,
    number_of_episodes: 40,
    in_production: true,
    languages: [],
    origin_country: ["US"],
    networks: [],
    last_episode_to_air: null,
    next_episode_to_air: null,
    seasons: [],
    created_by: [],
    production_companies: [],
    production_countries: [],
    spoken_languages: [],
    ...overrides,
  } as TMDBTVDetails
}

function createSeasonDetails(
  overrides: Partial<TMDBSeasonDetails> = {},
): TMDBSeasonDetails {
  return {
    id: 1,
    season_number: 1,
    name: "Season 1",
    overview: "",
    poster_path: null,
    air_date: null,
    vote_average: 0,
    episodes: [],
    ...overrides,
  } as TMDBSeasonDetails
}

describe("release calendar helpers", () => {
  it("only accepts exact-case supported region codes in the type guard", () => {
    expect(isSupportedRegionCode("US")).toBe(true)
    expect(isSupportedRegionCode("us")).toBe(false)
  })

  it("uses the stored region when valid and falls back to US when invalid", () => {
    expect(resolveUserRegion("MX")).toBe("MX")
    expect(resolveUserRegion("us")).toBe("US")
    expect(resolveUserRegion("invalid")).toBe(DEFAULT_REGION)
    expect(resolveUserRegion(undefined)).toBe(DEFAULT_REGION)
  })

  it("prefers the stored regional movie date over US/global fallbacks", () => {
    const details = createMovieDetails({
      release_date: "2026-04-15",
      release_dates: {
        id: 1,
        results: [
          {
            iso_3166_1: "US",
            release_dates: [
              {
                certification: "",
                iso_639_1: "",
                release_date: "2026-04-12T00:00:00.000Z",
                type: 3,
              },
            ],
          },
          {
            iso_3166_1: "BR",
            release_dates: [
              {
                certification: "",
                iso_639_1: "",
                release_date: "2026-04-10T00:00:00.000Z",
                type: 3,
              },
            ],
          },
        ],
      },
    })

    expect(
      resolveMovieReleaseDate({
        details,
        fallbackDate: "2026-04-20",
        region: "BR",
      }),
    ).toBe("2026-04-10")
  })

  it("builds season requests only for shows with resolvable seasons", () => {
    const items = dedupeTrackedItems([
      {
        id: 301,
        mediaType: "tv",
        title: "Returning Show",
        name: "Returning Show",
        posterPath: "/show.jpg",
        firstAirDate: "2024-01-01",
        sourceList: "watchlist",
      },
      {
        id: 302,
        mediaType: "tv",
        title: "Ended Show",
        name: "Ended Show",
        posterPath: "/ended.jpg",
        firstAirDate: "2020-01-01",
        sourceList: "favorites",
      },
    ])

    const tvDetailsById = new Map([
      [
        301,
        createTVDetails({
          id: 301,
          next_episode_to_air: {
            id: 91,
            name: "Premiere",
            overview: "",
            vote_average: 0,
            vote_count: 0,
            air_date: "2026-05-10",
            episode_number: 1,
            episode_type: "standard",
            production_code: "",
            runtime: null,
            season_number: 3,
            show_id: 301,
            still_path: null,
          },
        }),
      ],
      [
        302,
        createTVDetails({
          id: 302,
          status: "Ended",
          seasons: [
            {
              air_date: "2020-01-01",
              episode_count: 10,
              id: 1,
              name: "Season 1",
              overview: "",
              poster_path: null,
              season_number: 1,
              vote_average: 0,
            },
          ],
        }),
      ],
    ])

    expect(buildReleaseCalendarSeasonRequests(items, tvDetailsById)).toEqual([
      {
        showId: 301,
        seasonNumber: 3,
      },
    ])
  })

  it("prefers season episodes over the fallback next episode without duplicating the same release", () => {
    const items = dedupeTrackedItems([
      {
        id: 301,
        mediaType: "tv",
        title: "Returning Show",
        name: "Returning Show",
        posterPath: "/show.jpg",
        firstAirDate: "2024-01-01",
        sourceList: "watchlist",
      },
    ])

    const tvDetailsById = new Map([
      [
        301,
        createTVDetails({
          id: 301,
          name: "Returning Show",
          backdrop_path: "/show-backdrop.jpg",
          next_episode_to_air: {
            id: 91,
            name: "Premiere",
            overview: "",
            vote_average: 0,
            vote_count: 0,
            air_date: "2026-05-10",
            episode_number: 1,
            episode_type: "standard",
            production_code: "",
            runtime: null,
            season_number: 3,
            show_id: 301,
            still_path: null,
          },
        }),
      ],
    ])

    const releases = deriveReleaseCalendarReleases({
      items,
      region: "US",
      seasonDataByShowId: new Map([
        [
          301,
          {
            episodes: [
              {
                airDate: "2026-05-10",
                episodeName: "Premiere",
                episodeNumber: 1,
                seasonNumber: 3,
              },
              {
                airDate: "2026-05-17",
                episodeName: "Episode 2",
                episodeNumber: 2,
                seasonNumber: 3,
              },
            ],
          },
        ],
      ]),
      todayKey: "2026-05-01",
      tvDetailsById,
    })

    expect(releases).toHaveLength(2)
    expect(releases.map((release) => release.uniqueKey)).toEqual([
      "tv-301-s3-e1",
      "tv-301-s3-e2",
    ])
  })
})

describe("buildReleaseCalendarReleases", () => {
  it("dedupes tracked movies across lists and excludes past releases", async () => {
    const input: FetchReleaseCalendarInput = {
      region: "BR",
      todayKey: "2026-04-01",
      items: [
        {
          id: 101,
          mediaType: "movie",
          title: "Regional Movie",
          posterPath: "/movie.jpg",
          releaseDate: "2026-04-20",
          sourceList: "watchlist",
        },
        {
          id: 101,
          mediaType: "movie",
          title: "Regional Movie",
          posterPath: "/movie.jpg",
          releaseDate: "2026-04-20",
          sourceList: "favorites",
        },
        {
          id: 202,
          mediaType: "movie",
          title: "Past Movie",
          posterPath: null,
          releaseDate: "2026-03-01",
          sourceList: "watchlist",
        },
      ],
    }

    const fetchMovieDetails = vi.fn(async (movieId: number) => {
      if (movieId === 101) {
        return createMovieDetails({
          id: 101,
          backdrop_path: "/backdrop.jpg",
          release_dates: {
            id: 101,
            results: [
              {
                iso_3166_1: "BR",
                release_dates: [
                  {
                    certification: "",
                    iso_639_1: "",
                    release_date: "2026-04-10T00:00:00.000Z",
                    type: 3,
                  },
                ],
              },
            ],
          },
        })
      }

      return null
    })

    const releases = await buildReleaseCalendarReleases(input, {
      fetchMovieDetails,
      fetchTVDetails: vi.fn(async () => null),
      fetchSeasonDetails: vi.fn(async () => null),
    })

    expect(releases).toHaveLength(1)
    expect(releases[0]).toMatchObject({
      id: 101,
      releaseDate: "2026-04-10",
      sourceLists: ["favorites", "watchlist"],
      uniqueKey: "movie-101",
    })
  })

  it("fetches the highest regular season for active shows and caps future episodes at five", async () => {
    const requestedSeasons: Array<[number, number]> = []
    const releases = await buildReleaseCalendarReleases(
      {
        region: "US",
        todayKey: "2026-05-01",
        items: [
          {
            id: 301,
            mediaType: "tv",
            title: "Returning Show",
            name: "Returning Show",
            posterPath: "/show.jpg",
            firstAirDate: "2024-01-01",
            sourceList: "currently-watching",
          },
        ],
      },
      {
        fetchMovieDetails: vi.fn(async () => null),
        fetchTVDetails: vi.fn(async () =>
          createTVDetails({
            id: 301,
            status: "In Production",
            seasons: [
              { season_number: 0 },
              { season_number: 1 },
              { season_number: 2 },
              { season_number: 3 },
            ] as TMDBTVDetails["seasons"],
          }),
        ),
        fetchSeasonDetails: vi.fn(async (tvId: number, seasonNumber: number) => {
          requestedSeasons.push([tvId, seasonNumber])
          return createSeasonDetails({
            season_number: seasonNumber,
            episodes: [
              {
                id: 1,
                episode_number: 1,
                season_number: seasonNumber,
                name: "Past episode",
                overview: "",
                air_date: "2026-04-20",
                runtime: null,
                still_path: null,
                vote_average: 0,
                vote_count: 0,
              },
              ...Array.from({ length: 6 }).map((_, index) => ({
                id: index + 2,
                episode_number: index + 2,
                season_number: seasonNumber,
                name: `Episode ${index + 2}`,
                overview: "",
                air_date: `2026-05-0${index + 1}`,
                runtime: null,
                still_path: null,
                vote_average: 0,
                vote_count: 0,
              })),
            ],
          })
        }),
      },
    )

    expect(requestedSeasons).toEqual([[301, 3]])
    expect(releases).toHaveLength(5)
    expect(releases[0]?.releaseDate).toBe("2026-05-01")
    expect(releases[4]?.releaseDate).toBe("2026-05-05")
  })

  it("falls back to next_episode_to_air when season enrichment has no future episodes", async () => {
    const releases = await buildReleaseCalendarReleases(
      {
        region: "US",
        todayKey: "2026-06-01",
        items: [
          {
            id: 401,
            mediaType: "tv",
            title: "Fallback Show",
            name: "Fallback Show",
            posterPath: null,
            firstAirDate: "2024-01-01",
            sourceList: "favorites",
          },
        ],
      },
      {
        fetchMovieDetails: vi.fn(async () => null),
        fetchTVDetails: vi.fn(async () =>
          createTVDetails({
            id: 401,
            next_episode_to_air: {
              id: 900,
              show_id: 401,
              name: "Big Return",
              overview: "",
              vote_average: 0,
              vote_count: 0,
              air_date: "2026-06-10",
              episode_number: 2,
              episode_type: "standard",
              production_code: "",
              runtime: null,
              season_number: 4,
              still_path: null,
            },
            seasons: [{ season_number: 4 }] as TMDBTVDetails["seasons"],
          }),
        ),
        fetchSeasonDetails: vi.fn(async () =>
          createSeasonDetails({
            season_number: 4,
            episodes: [],
          }),
        ),
      },
    )

    expect(releases).toHaveLength(1)
    expect(releases[0]).toMatchObject({
      id: 401,
      releaseDate: "2026-06-10",
      nextEpisode: {
        seasonNumber: 4,
        episodeNumber: 2,
        episodeName: "Big Return",
      },
    })
  })

  it("caps mixed movie and tv detail enrichment at the shared concurrency limit", async () => {
    let activeRequests = 0
    let maxActiveRequests = 0

    const waitForTurn = async () => {
      activeRequests += 1
      maxActiveRequests = Math.max(maxActiveRequests, activeRequests)
      await new Promise((resolve) => setTimeout(resolve, 5))
      activeRequests -= 1
    }

    await buildReleaseCalendarReleases(
      {
        region: "US",
        todayKey: "2026-05-01",
        items: [
          ...Array.from({ length: 8 }).map((_, index) => ({
            id: index + 1,
            mediaType: "movie" as const,
            title: `Movie ${index + 1}`,
            posterPath: null,
            releaseDate: "2026-05-20",
            sourceList: "watchlist" as const,
          })),
          ...Array.from({ length: 8 }).map((_, index) => ({
            id: index + 101,
            mediaType: "tv" as const,
            title: `Show ${index + 1}`,
            name: `Show ${index + 1}`,
            posterPath: null,
            firstAirDate: "2024-01-01",
            sourceList: "currently-watching" as const,
          })),
        ],
      },
      {
        fetchMovieDetails: vi.fn(async () => {
          await waitForTurn()
          return null
        }),
        fetchTVDetails: vi.fn(async (tvId: number) => {
          await waitForTurn()
          return createTVDetails({
            id: tvId,
            status: "Ended",
            seasons: [],
          })
        }),
        fetchSeasonDetails: vi.fn(async () => null),
        concurrency: 10,
      },
    )

    expect(maxActiveRequests).toBeLessThanOrEqual(10)
  })
})
