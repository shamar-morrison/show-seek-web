import { fetchSeasonEpisodes, fetchTVShowDetails } from "@/app/actions"
import { useWatchProgressEnrichment } from "@/hooks/use-watch-progress-enrichment"
import type { WatchProgressItem } from "@/hooks/use-episode-tracking"
import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/app/actions", () => ({
  fetchTVShowDetails: vi.fn(),
  fetchSeasonEpisodes: vi.fn(),
}))

function createBaseProgressItem(overrides: Partial<WatchProgressItem> = {}): WatchProgressItem {
  return {
    tvShowId: 101,
    tvShowName: "Test Show",
    posterPath: "/poster.jpg",
    backdropPath: null,
    lastUpdated: Date.now(),
    percentage: 0,
    timeRemaining: 0,
    watchedCount: 0,
    totalEpisodes: 0,
    avgRuntime: 45,
    lastWatchedEpisode: {
      season: 1,
      episode: 1,
      title: "Episode 1",
    },
    nextEpisode: null,
    isHidden: false,
    ...overrides,
  }
}

describe("useWatchProgressEnrichment", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
  })

  it("uses details.totalEpisodes when regular seasonCounts reduction is zero", async () => {
    vi.mocked(fetchTVShowDetails).mockResolvedValue({
      id: 101,
      status: "Returning Series",
      number_of_episodes: 12,
      totalEpisodes: 12,
      avgRuntime: 45,
      seasons: [], // Empty seasons array
      next_episode_to_air: null,
      last_episode_to_air: null,
      genres: [],
      overview: "",
      poster_path: "/poster.jpg",
      backdrop_path: null,
      name: "Test Show",
      first_air_date: "2020-01-01",
      last_air_date: null,
      number_of_seasons: 1,
      vote_average: 8,
      vote_count: 100,
    } as never)

    vi.mocked(fetchSeasonEpisodes).mockResolvedValue([])

    const initial = [createBaseProgressItem()]
    const watchedMap = new Map<number, Set<string>>([[101, new Set()]])

    const { result } = renderHook(() =>
      useWatchProgressEnrichment(initial, watchedMap),
    )

    await waitFor(() => {
      expect(result.current.enrichedProgress[0].totalEpisodes).toBe(12)
    })
  })

  it("filters watchedKeys in watched-ahead branch to valid regular episodes within season counts", async () => {
    vi.mocked(fetchTVShowDetails).mockResolvedValue({
      id: 101,
      status: "Returning Series",
      number_of_episodes: 10,
      totalEpisodes: 10,
      avgRuntime: 45,
      seasons: [
        {
          id: 1,
          season_number: 1,
          episode_count: 5,
          air_date: "2020-01-01",
          name: "Season 1",
          overview: "",
          poster_path: null,
          vote_average: 8,
        },
      ],
      next_episode_to_air: {
        id: 105,
        season_number: 1,
        episode_number: 5,
        name: "Episode 5",
        air_date: "2099-01-01", // Future
      },
      last_episode_to_air: {
        id: 101,
        season_number: 1,
        episode_number: 1,
        name: "Episode 1",
        air_date: "2020-01-01", // Only episode 1 is aired
      },
      genres: [],
      overview: "",
      poster_path: null,
      backdrop_path: null,
      name: "Test Show",
      first_air_date: "2020-01-01",
      last_air_date: null,
      number_of_seasons: 1,
      vote_average: 8,
      vote_count: 100,
    } as never)

    vi.mocked(fetchSeasonEpisodes).mockResolvedValue([
      {
        id: 101,
        episode_number: 1,
        name: "Episode 1",
        air_date: "2020-01-01",
        runtime: 45,
      },
    ])

    // Watched keys include:
    // - "1_1": valid aired
    // - "1_2": valid unaired (triggers hasWatchedAhead)
    // - "0_1": season 0 special (should NOT be counted)
    // - "1_99": episode beyond season 1's episode_count of 5 (should NOT be counted)
    // - "malformed": invalid key syntax (should NOT be counted)
    const watchedMap = new Map<number, Set<string>>([
      [101, new Set(["1_1", "1_2", "0_1", "1_99", "malformed"])],
    ])

    const initial = [createBaseProgressItem()]

    const { result } = renderHook(() =>
      useWatchProgressEnrichment(initial, watchedMap),
    )

    await waitFor(() => {
      // Only "1_1" and "1_2" are valid regular episodes within count (2)
      expect(result.current.enrichedProgress[0].watchedCount).toBe(2)
      // Percentage: 2 / 5 = 40%
      expect(result.current.enrichedProgress[0].percentage).toBe(40)
    })
  })

  it("re-enriches a show when its watched keys change while mounted (not requiring remount)", async () => {
    vi.mocked(fetchTVShowDetails).mockResolvedValue({
      id: 101,
      status: "Returning Series",
      number_of_episodes: 2,
      totalEpisodes: 2,
      avgRuntime: 45,
      seasons: [
        {
          id: 1,
          season_number: 1,
          episode_count: 2,
          air_date: "2020-01-01",
          name: "Season 1",
          overview: "",
          poster_path: null,
          vote_average: 8,
        },
      ],
      next_episode_to_air: null,
      last_episode_to_air: {
        id: 102,
        season_number: 1,
        episode_number: 2,
        name: "Episode 2",
        air_date: "2020-01-08",
      },
      genres: [],
      overview: "",
      poster_path: null,
      backdrop_path: null,
      name: "Test Show",
      first_air_date: "2020-01-01",
      last_air_date: "2020-01-08",
      number_of_seasons: 1,
      vote_average: 8,
      vote_count: 100,
    } as never)

    vi.mocked(fetchSeasonEpisodes).mockResolvedValue([
      {
        id: 101,
        episode_number: 1,
        name: "Episode 1",
        air_date: "2020-01-01",
        runtime: 45,
      },
      {
        id: 102,
        episode_number: 2,
        name: "Episode 2",
        air_date: "2020-01-08",
        runtime: 45,
      },
    ])

    // Initial mount: only episode 1 watched
    const initial1 = [
      createBaseProgressItem({
        tvShowId: 101,
        watchedCount: 1,
        totalEpisodes: 2,
        lastUpdated: 1000,
      }),
    ]
    const watchedMap1 = new Map<number, Set<string>>([
      [101, new Set(["1_1"])],
    ])

    const { result, rerender } = renderHook(
      ({ initial, watched }) => useWatchProgressEnrichment(initial, watched),
      {
        initialProps: {
          initial: initial1,
          watched: watchedMap1,
        },
      },
    )

    // Wait for first enrichment
    await waitFor(() => {
      expect(result.current.enrichedProgress[0].percentage).toBe(50)
      expect(result.current.enrichedProgress[0].nextEpisode).toEqual({
        kind: "unwatched",
        season: 1,
        episode: 2,
        title: "Episode 2",
      })
    })

    // User marks episode 2 watched while component is still mounted!
    const initial2 = [
      createBaseProgressItem({
        tvShowId: 101,
        watchedCount: 2,
        totalEpisodes: 2,
        lastUpdated: 2000,
      }),
    ]
    const watchedMap2 = new Map<number, Set<string>>([
      [101, new Set(["1_1", "1_2"])],
    ])

    rerender({
      initial: initial2,
      watched: watchedMap2,
    })

    // Must re-enrich and update percentage and nextEpisode without remount!
    await waitFor(() => {
      expect(result.current.enrichedProgress[0].percentage).toBe(100)
      expect(result.current.enrichedProgress[0].nextEpisode).toEqual({
        kind: "upcoming",
        season: 0,
        episode: 0,
        title: "Caught up!",
      })
    })
  })
})
