import { computeNextEpisode, parseEpisodeKey } from "@/lib/episode-utils"
import type { TMDBSeason, TMDBSeasonEpisode } from "@/types/tmdb"
import { describe, expect, it } from "vitest"

describe("parseEpisodeKey", () => {
  it("parses valid season and episode keys", () => {
    expect(parseEpisodeKey("1_5")).toEqual({ season: 1, episode: 5 })
    expect(parseEpisodeKey("10_22")).toEqual({ season: 10, episode: 22 })
  })

  it("returns null for invalid keys", () => {
    expect(parseEpisodeKey("invalid")).toBeNull()
    expect(parseEpisodeKey("")).toBeNull()
    expect(parseEpisodeKey("1-5")).toBeNull()
  })
})

describe("computeNextEpisode", () => {
  const createEpisode = (
    season: number,
    episode: number,
    name: string,
    airDate = "2020-01-01",
  ): TMDBSeasonEpisode => ({
    id: season * 100 + episode,
    season_number: season,
    episode_number: episode,
    name,
    air_date: airDate,
    overview: "",
    runtime: 45,
    still_path: null,
    vote_average: 8,
    vote_count: 100,
  })

  const season1Episodes: TMDBSeasonEpisode[] = [
    createEpisode(1, 1, "S1E1"),
    createEpisode(1, 2, "S1E2"),
    createEpisode(1, 3, "S1E3"),
  ]

  const tvShowSeasons: TMDBSeason[] = [
    {
      id: 1001,
      season_number: 1,
      name: "Season 1",
      episode_count: 3,
      air_date: "2020-01-01",
      overview: "",
      poster_path: null,
      vote_average: 8,
    },
    {
      id: 1002,
      season_number: 2,
      name: "Season 2",
      episode_count: 3,
      air_date: "2021-01-01",
      overview: "",
      poster_path: null,
      vote_average: 8,
    },
  ]

  it("returns the next unwatched episode in the current season", () => {
    const next = computeNextEpisode(
      { season_number: 1, episode_number: 1 },
      season1Episodes,
      tvShowSeasons,
      new Set(["1_1"]),
    )

    expect(next).toEqual({
      season: 1,
      episode: 2,
      title: "S1E2",
      airDate: "2020-01-01",
    })
  })

  it("skips already watched episodes within current season", () => {
    // S1E1 is being marked watched, S1E2 is already watched
    const next = computeNextEpisode(
      { season_number: 1, episode_number: 1 },
      season1Episodes,
      tvShowSeasons,
      new Set(["1_1", "1_2"]),
    )

    expect(next).toEqual({
      season: 1,
      episode: 3,
      title: "S1E3",
      airDate: "2020-01-01",
    })
  })

  it("advances to subsequent season when current season is complete", () => {
    const next = computeNextEpisode(
      { season_number: 1, episode_number: 3 },
      season1Episodes,
      tvShowSeasons,
      new Set(["1_1", "1_2", "1_3"]),
    )

    expect(next).toEqual({
      season: 2,
      episode: 1,
      title: "Season 2 Episode 1",
      airDate: "2021-01-01",
    })
  })

  it("skips already-watched episodes in subsequent seasons using episode counts", () => {
    // Current season 1 complete, but Season 2 Episode 1 was already watched!
    const next = computeNextEpisode(
      { season_number: 1, episode_number: 3 },
      season1Episodes,
      tvShowSeasons,
      new Set(["1_1", "1_2", "1_3", "2_1"]),
    )

    expect(next).toEqual({
      season: 2,
      episode: 2,
      title: "Season 2 Episode 2",
      airDate: "2021-01-01",
    })
  })

  it("skips subsequent season when all its episodes are already watched", () => {
    const seasonsWith3: TMDBSeason[] = [
      ...tvShowSeasons,
      {
        id: 1003,
        season_number: 3,
        name: "Season 3",
        episode_count: 2,
        air_date: "2022-01-01",
        overview: "",
        poster_path: null,
        vote_average: 8,
      },
    ]

    // Season 1 complete, all of Season 2 (2_1, 2_2, 2_3) watched
    const next = computeNextEpisode(
      { season_number: 1, episode_number: 3 },
      season1Episodes,
      seasonsWith3,
      new Set(["1_1", "1_2", "1_3", "2_1", "2_2", "2_3"]),
    )

    expect(next).toEqual({
      season: 3,
      episode: 1,
      title: "Season 3 Episode 1",
      airDate: "2022-01-01",
    })
  })

  it("uses actual subsequent season episode data when episodes array is provided", () => {
    const season2Episodes: TMDBSeasonEpisode[] = [
      createEpisode(2, 1, "S2 Premiere"),
      createEpisode(2, 2, "S2 Chapter Two"),
    ]

    const seasonsWithEpisodes = [
      tvShowSeasons[0],
      {
        ...tvShowSeasons[1],
        episodes: season2Episodes,
      },
    ]

    // S2E1 already watched
    const next = computeNextEpisode(
      { season_number: 1, episode_number: 3 },
      season1Episodes,
      seasonsWithEpisodes,
      new Set(["1_1", "1_2", "1_3", "2_1"]),
    )

    expect(next).toEqual({
      season: 2,
      episode: 2,
      title: "S2 Chapter Two",
      airDate: "2020-01-01",
    })
  })

  it("returns null when all seasons and episodes are watched", () => {
    const next = computeNextEpisode(
      { season_number: 2, episode_number: 3 },
      season1Episodes,
      tvShowSeasons,
      new Set(["1_1", "1_2", "1_3", "2_1", "2_2", "2_3"]),
    )

    expect(next).toBeNull()
  })
})
