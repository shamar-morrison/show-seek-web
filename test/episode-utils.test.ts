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

  it("returns null when current season is complete, even if a subsequent season has started airing in the past with 10 announced episodes", () => {
    const seasonsWithAiredS2: TMDBSeason[] = [
      tvShowSeasons[0],
      {
        ...tvShowSeasons[1],
        air_date: "2020-01-01", // Air date is in the past!
        episode_count: 10, // 10 announced episodes, but we don't know how many have aired
      },
    ]

    // Season 1 fully watched, user hasn't watched into Season 2
    const next = computeNextEpisode(
      { season_number: 1, episode_number: 3 },
      season1Episodes,
      seasonsWithAiredS2,
      new Set(["1_1", "1_2", "1_3"]),
    )

    // Must return null rather than guessing an episode number, since we can't know which of the 10 aired
    expect(next).toBeNull()
  })

  it("returns null when subsequent season is announced but has not aired yet (e.g. Severance S2 announced with future air date)", () => {
    const seasonsWithFutureS2: TMDBSeason[] = [
      tvShowSeasons[0],
      {
        ...tvShowSeasons[1],
        air_date: "2099-01-01", // Future air date
        episode_count: 8,
      },
    ]

    // Season 1 fully watched
    const next = computeNextEpisode(
      { season_number: 1, episode_number: 3 },
      season1Episodes,
      seasonsWithFutureS2,
      new Set(["1_1", "1_2", "1_3"]),
    )

    expect(next).toBeNull()
  })

  it("returns null when subsequent season has no air date (null air date)", () => {
    const seasonsWithUnscheduledS2: TMDBSeason[] = [
      tvShowSeasons[0],
      {
        ...tvShowSeasons[1],
        air_date: null as unknown as string,
        episode_count: 8,
      },
    ]

    // Season 1 fully watched
    const next = computeNextEpisode(
      { season_number: 1, episode_number: 3 },
      season1Episodes,
      seasonsWithUnscheduledS2,
      new Set(["1_1", "1_2", "1_3"]),
    )

    expect(next).toBeNull()
  })

  it("returns null when all episodes in current season are watched without tvShowSeasons", () => {
    const next = computeNextEpisode(
      { season_number: 1, episode_number: 3 },
      season1Episodes,
      undefined,
      new Set(["1_1", "1_2", "1_3"]),
    )

    expect(next).toBeNull()
  })
})
