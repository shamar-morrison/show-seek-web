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

function buildWatchedRangeKeys(
  season: number,
  startEp: number,
  endEp: number,
): string[] {
  const keys: string[] = []
  for (let ep = startEp; ep <= endEp; ep++) {
    keys.push(`${season}_${ep}`)
  }
  return keys
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

  it("discards out-of-order older enrichment resolution when a newer request has already committed", async () => {
    let resolveCall1!: (value: unknown) => void
    const call1Promise = new Promise((resolve) => {
      resolveCall1 = resolve
    })

    let callCount = 0
    vi.mocked(fetchTVShowDetails).mockImplementation(async () => {
      callCount += 1
      if (callCount === 1) {
        // First call is delayed
        await call1Promise
      }
      return {
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
      } as never
    })

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

    // Mount with Call 1: only episode 1 watched (pending on call1Promise)
    const initial1 = [
      createBaseProgressItem({
        tvShowId: 101,
        watchedCount: 1,
        totalEpisodes: 2,
        lastUpdated: 1000,
      }),
    ]
    const watchedMap1 = new Map([[101, new Set(["1_1"])]])

    const { result, rerender } = renderHook(
      ({ initial, watched }) => useWatchProgressEnrichment(initial, watched),
      {
        initialProps: {
          initial: initial1,
          watched: watchedMap1,
        },
      },
    )

    // Call 1 is in-flight. User quickly marks episode 2 watched before Call 1 resolves!
    const initial2 = [
      createBaseProgressItem({
        tvShowId: 101,
        watchedCount: 2,
        totalEpisodes: 2,
        lastUpdated: 2000,
      }),
    ]
    const watchedMap2 = new Map([[101, new Set(["1_1", "1_2"])]])

    rerender({
      initial: initial2,
      watched: watchedMap2,
    })

    // Call 2 completes immediately (callCount === 2, not waiting on call1Promise)
    await waitFor(() => {
      expect(result.current.enrichedProgress[0].percentage).toBe(100)
      expect(result.current.enrichedProgress[0].nextEpisode).toEqual({
        kind: "upcoming",
        season: 0,
        episode: 0,
        title: "Caught up!",
      })
    })

    // Verify sessionStorage has Call 2's data
    const cachedBefore = JSON.parse(
      sessionStorage.getItem("watch_progress_enrichment_101") || "{}",
    )
    expect(cachedBefore.watchedKeysHash).toBe("1_1,1_2")
    expect(cachedBefore.data.percentage).toBe(100)

    // Now, Call 1 (the older request) finally resolves!
    await act(async () => {
      resolveCall1(null)
    })

    // The older Call 1 must be DISCARDED:
    // 1. React state must NOT be clobbered back to 50%
    expect(result.current.enrichedProgress[0].percentage).toBe(100)
    expect(result.current.enrichedProgress[0].nextEpisode).toEqual({
      kind: "upcoming",
      season: 0,
      episode: 0,
      title: "Caught up!",
    })

    // 2. sessionStorage must NOT be overwritten with stale 50% data
    const cachedAfter = JSON.parse(
      sessionStorage.getItem("watch_progress_enrichment_101") || "{}",
    )
    expect(cachedAfter.watchedKeysHash).toBe("1_1,1_2")
    expect(cachedAfter.data.percentage).toBe(100)

    // 3. enrichedShowsRef must NOT be reverted to the older hash
    // If it were reverted to "1_1", rerendering with watchedMap2 ("1_1,1_2") would trigger an unwanted fetch.
    const callCountBeforeRerender = callCount
    rerender({
      initial: initial2,
      watched: watchedMap2,
    })
    expect(callCount).toBe(callCountBeforeRerender)
  })

  it("discards cache-hit enrichment when watched keys change while an earlier batch is in-flight", async () => {
    let resolveBatch1!: (value: unknown) => void
    const batch1Promise = new Promise((resolve) => {
      resolveBatch1 = resolve
    })

    // Pre-seed sessionStorage with a 50% cached entry for show 106 under hash "1_1"
    sessionStorage.setItem(
      "watch_progress_enrichment_106",
      JSON.stringify({
        timestamp: Date.now(),
        watchedKeysHash: "1_1",
        data: {
          percentage: 50,
          watchedCount: 1,
          totalEpisodes: 2,
        },
      }),
    )

    // Items 101..105 will be in batch 1, item 106 in batch 2 (BATCH_CONCURRENCY is 5)
    const items = [101, 102, 103, 104, 105, 106].map((id) =>
      createBaseProgressItem({
        tvShowId: id,
        watchedCount: 1,
        totalEpisodes: 2,
      }),
    )

    const watchedMap1 = new Map(
      items.map((it) => [it.tvShowId, new Set(["1_1"])]),
    )

    vi.mocked(fetchTVShowDetails).mockImplementation(async (showId) => {
      if (showId === 101) {
        await batch1Promise
      }
      return {
        id: showId,
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
          id: 999,
          season_number: 1,
          episode_number: 2,
          name: "Episode 2",
          air_date: "2020-01-08",
        },
        genres: [],
        overview: "",
        poster_path: null,
        backdrop_path: null,
        name: `Show ${showId}`,
        first_air_date: "2020-01-01",
        last_air_date: "2020-01-08",
        number_of_seasons: 1,
        vote_average: 8,
        vote_count: 100,
      } as never
    })

    vi.mocked(fetchSeasonEpisodes).mockResolvedValue([
      {
        id: 998,
        episode_number: 1,
        name: "Episode 1",
        air_date: "2020-01-01",
        runtime: 45,
      },
      {
        id: 999,
        episode_number: 2,
        name: "Episode 2",
        air_date: "2020-01-08",
        runtime: 45,
      },
    ])

    const { result, rerender } = renderHook(
      ({ initial, watched }) => useWatchProgressEnrichment(initial, watched),
      {
        initialProps: {
          initial: items,
          watched: watchedMap1,
        },
      },
    )

    // While batch 1 is awaiting batch1Promise, user marks episode 2 on show 106!
    const items2 = items.map((it) =>
      it.tvShowId === 106
        ? { ...it, watchedCount: 2, lastUpdated: 2000 }
        : it,
    )
    const watchedMap2 = new Map(watchedMap1)
    watchedMap2.set(106, new Set(["1_1", "1_2"]))

    rerender({
      initial: items2,
      watched: watchedMap2,
    })

    // Now resolve batch 1, allowing the first run to proceed to batch 2 (show 106)
    await act(async () => {
      resolveBatch1(null)
    })

    // Show 106's cached 50% hit from batch 2 of run 1 must be discarded because
    // latestHash ("1_1,1_2") !== watchedKeysHash ("1_1").
    // Run 2 processes show 106 with its new watched keys and enriches to 100%.
    await waitFor(() => {
      const show106 = result.current.enrichedProgress.find(
        (p) => p.tvShowId === 106,
      )
      expect(show106?.percentage).toBe(100)
    })
  })

  it("handles fully-watched show with continuous episode numbering (HxH bug)", async () => {
    vi.mocked(fetchTVShowDetails).mockResolvedValue({
      id: 46298,
      name: "Hunter x Hunter",
      status: "Ended",
      number_of_episodes: 148,
      totalEpisodes: 148,
      avgRuntime: 30,
      seasons: [
        { season_number: 1, episode_count: 62, air_date: "2011-10-02" },
        { season_number: 2, episode_count: 74, air_date: "2012-12-15" },
        { season_number: 3, episode_count: 12, air_date: "2014-07-07" },
      ],
      last_episode_to_air: {
        season_number: 3,
        episode_number: 148,
        air_date: "2014-09-24",
      },
      next_episode_to_air: null,
      genres: [],
      overview: "",
      poster_path: "/hxh.jpg",
      backdrop_path: null,
      first_air_date: "2011-10-02",
      last_air_date: "2014-09-24",
      number_of_seasons: 3,
      vote_average: 9,
      vote_count: 1000,
    } as never)

    vi.mocked(fetchSeasonEpisodes).mockResolvedValue([
      {
        id: 148,
        episode_number: 148,
        name: "Finale",
        air_date: "2014-09-24",
        runtime: 30,
      },
    ] as never)

    const watched = new Set([
      ...buildWatchedRangeKeys(1, 1, 62),
      ...buildWatchedRangeKeys(2, 63, 136),
      ...buildWatchedRangeKeys(3, 137, 148),
    ])

    const initial = [createBaseProgressItem({ tvShowId: 46298, avgRuntime: 30 })]
    const watchedMap = new Map([[46298, watched]])

    const { result } = renderHook(() =>
      useWatchProgressEnrichment(initial, watchedMap),
    )

    await waitFor(() => {
      expect(result.current.enrichedProgress[0].percentage).toBe(100)
    })

    expect(result.current.enrichedProgress[0]).toEqual(
      expect.objectContaining({
        tvShowId: 46298,
        percentage: 100,
        timeRemaining: 0,
        showEnded: true,
        nextEpisode: { kind: "complete" },
      }),
    )
  })

  it("handles partially-watched mid-continuous-season show", async () => {
    vi.mocked(fetchTVShowDetails).mockResolvedValue({
      id: 46298,
      name: "Hunter x Hunter",
      status: "Ended",
      number_of_episodes: 148,
      totalEpisodes: 148,
      avgRuntime: 30,
      seasons: [
        { season_number: 1, episode_count: 62, air_date: "2011-10-02" },
        { season_number: 2, episode_count: 74, air_date: "2012-12-15" },
        { season_number: 3, episode_count: 12, air_date: "2014-07-07" },
      ],
      last_episode_to_air: {
        season_number: 3,
        episode_number: 148,
        air_date: "2014-09-24",
      },
      next_episode_to_air: null,
      genres: [],
      overview: "",
      poster_path: "/hxh.jpg",
      backdrop_path: null,
      first_air_date: "2011-10-02",
      last_air_date: "2014-09-24",
      number_of_seasons: 3,
      vote_average: 9,
      vote_count: 1000,
    } as never)

    const s2Episodes = []
    for (let ep = 63; ep <= 136; ep++) {
      s2Episodes.push({
        id: ep,
        episode_number: ep,
        name: ep === 73 ? "Insane x Inquest" : `Episode ${ep}`,
        air_date: "2013-03-10",
        runtime: 30,
      })
    }
    vi.mocked(fetchSeasonEpisodes).mockResolvedValue(s2Episodes as never)

    const watched = new Set([
      ...buildWatchedRangeKeys(1, 1, 62),
      ...buildWatchedRangeKeys(2, 63, 72),
    ])

    const initial = [createBaseProgressItem({ tvShowId: 46298, avgRuntime: 30 })]
    const watchedMap = new Map([[46298, watched]])

    const { result } = renderHook(() =>
      useWatchProgressEnrichment(initial, watchedMap),
    )

    await waitFor(() => {
      expect((result.current.enrichedProgress[0].nextEpisode as any)?.title).toBe("Insane x Inquest")
    })

    expect(result.current.enrichedProgress[0]).toEqual(
      expect.objectContaining({
        tvShowId: 46298,
        // 72 watched out of 148 total = 49%
        percentage: 49,
        // 76 unwatched aired episodes * 30 min = 2280 min
        timeRemaining: 2280,
        nextEpisode: {
          kind: "unwatched",
          season: 2,
          episode: 73,
          title: "Insane x Inquest",
        },
      }),
    )
  })

  it("handles zero-watched freshly-started continuous season with season-details fetch", async () => {
    vi.mocked(fetchTVShowDetails).mockResolvedValue({
      id: 46298,
      name: "Hunter x Hunter",
      status: "Returning Series",
      number_of_episodes: 136,
      totalEpisodes: 136,
      avgRuntime: 30,
      seasons: [
        { season_number: 1, episode_count: 62, air_date: "2011-10-02" },
        { season_number: 2, episode_count: 74, air_date: "2026-03-01" },
      ],
      last_episode_to_air: {
        season_number: 2,
        episode_number: 65,
        air_date: "2026-03-05",
      },
      next_episode_to_air: null,
      genres: [],
      overview: "",
      poster_path: "/hxh.jpg",
      backdrop_path: null,
      first_air_date: "2011-10-02",
      last_air_date: "2026-03-05",
      number_of_seasons: 2,
      vote_average: 9,
      vote_count: 1000,
    } as never)

    vi.mocked(fetchSeasonEpisodes).mockResolvedValue([
      { id: 63, episode_number: 63, name: "S2 Premiere", air_date: "2026-03-01", runtime: 30 },
      { id: 64, episode_number: 64, name: "S2 Episode 2", air_date: "2026-03-03", runtime: 30 },
      { id: 65, episode_number: 65, name: "S2 Episode 3", air_date: "2026-03-05", runtime: 30 },
      { id: 66, episode_number: 66, name: "S2 Episode 4", air_date: "2026-03-15", runtime: 30 },
    ] as never)

    const watched = new Set([
      ...buildWatchedRangeKeys(1, 1, 62),
    ])

    const initial = [createBaseProgressItem({ tvShowId: 46298, avgRuntime: 30 })]
    const watchedMap = new Map([[46298, watched]])

    const { result } = renderHook(() =>
      useWatchProgressEnrichment(initial, watchedMap),
    )

    await waitFor(() => {
      expect((result.current.enrichedProgress[0].nextEpisode as any)?.title).toBe("S2 Premiere")
    })

    expect(result.current.enrichedProgress[0]).toEqual(
      expect.objectContaining({
        tvShowId: 46298,
        // 62 watched out of 136 total = 46%
        percentage: 46,
        // 3 unwatched aired episodes * 30 min = 90 min
        timeRemaining: 90,
        nextEpisode: {
          kind: "unwatched",
          season: 2,
          episode: 63,
          title: "S2 Premiere",
        },
      }),
    )
  })

  it("handles continuously-numbered show with still-airing final season capping correctly", async () => {
    vi.mocked(fetchTVShowDetails).mockResolvedValue({
      id: 46298,
      name: "Hunter x Hunter",
      status: "Returning Series",
      number_of_episodes: 148,
      totalEpisodes: 148,
      avgRuntime: 30,
      seasons: [
        { season_number: 1, episode_count: 62, air_date: "2011-10-02" },
        { season_number: 2, episode_count: 74, air_date: "2012-12-15" },
        { season_number: 3, episode_count: 12, air_date: "2026-03-01" },
      ],
      last_episode_to_air: {
        season_number: 3,
        episode_number: 140,
        air_date: "2026-03-08",
      },
      next_episode_to_air: null,
      genres: [],
      overview: "",
      poster_path: "/hxh.jpg",
      backdrop_path: null,
      first_air_date: "2011-10-02",
      last_air_date: "2026-03-08",
      number_of_seasons: 3,
      vote_average: 9,
      vote_count: 1000,
    } as never)

    vi.mocked(fetchSeasonEpisodes).mockResolvedValue([
      { id: 137, episode_number: 137, name: "S3E1", air_date: "2026-03-01", runtime: 30 },
      { id: 138, episode_number: 138, name: "S3E2", air_date: "2026-03-03", runtime: 30 },
      { id: 139, episode_number: 139, name: "S3E3", air_date: "2026-03-05", runtime: 30 },
      { id: 140, episode_number: 140, name: "S3E4", air_date: "2026-03-08", runtime: 30 },
      { id: 141, episode_number: 141, name: "S3E5", air_date: "2026-03-15", runtime: 30 },
    ] as never)

    const watched = new Set([
      ...buildWatchedRangeKeys(1, 1, 62),
      ...buildWatchedRangeKeys(2, 63, 136),
      ...buildWatchedRangeKeys(3, 137, 138),
    ])

    const initial = [createBaseProgressItem({ tvShowId: 46298, avgRuntime: 30 })]
    const watchedMap = new Map([[46298, watched]])

    const { result } = renderHook(() =>
      useWatchProgressEnrichment(initial, watchedMap),
    )

    await waitFor(() => {
      expect((result.current.enrichedProgress[0].nextEpisode as any)?.title).toBe("S3E3")
    })

    expect(result.current.enrichedProgress[0]).toEqual(
      expect.objectContaining({
        tvShowId: 46298,
        // 138 watched out of 148 total = 93%
        percentage: 93,
        // 2 unwatched aired episodes (139, 140) * 30 min = 60 min
        timeRemaining: 60,
        nextEpisode: {
          kind: "unwatched",
          season: 3,
          episode: 139,
          title: "S3E3",
        },
      }),
    )
  })

  it("handles standard 1-based show as regression check", async () => {
    vi.mocked(fetchTVShowDetails).mockResolvedValue({
      id: 800,
      name: "Standard Show",
      status: "Returning Series",
      number_of_episodes: 20,
      totalEpisodes: 20,
      avgRuntime: 30,
      seasons: [
        { season_number: 1, episode_count: 10, air_date: "2025-01-01" },
        { season_number: 2, episode_count: 10, air_date: "2026-03-01" },
      ],
      last_episode_to_air: {
        season_number: 2,
        episode_number: 5,
        air_date: "2026-03-08",
      },
      next_episode_to_air: null,
      genres: [],
      overview: "",
      poster_path: "/standard.jpg",
      backdrop_path: null,
      first_air_date: "2025-01-01",
      last_air_date: "2026-03-08",
      number_of_seasons: 2,
      vote_average: 8,
      vote_count: 100,
    } as never)

    vi.mocked(fetchSeasonEpisodes).mockResolvedValue([
      { id: 1, episode_number: 1, name: "S2E1", air_date: "2026-03-01", runtime: 30 },
      { id: 2, episode_number: 2, name: "S2E2", air_date: "2026-03-02", runtime: 30 },
      { id: 3, episode_number: 3, name: "S2E3", air_date: "2026-03-03", runtime: 30 },
      { id: 4, episode_number: 4, name: "S2E4", air_date: "2026-03-05", runtime: 30 },
      { id: 5, episode_number: 5, name: "S2E5", air_date: "2026-03-08", runtime: 30 },
      { id: 6, episode_number: 6, name: "S2E6", air_date: "2026-03-15", runtime: 30 },
    ] as never)

    const watched = new Set([
      ...buildWatchedRangeKeys(1, 1, 10),
      ...buildWatchedRangeKeys(2, 1, 2),
    ])

    const initial = [createBaseProgressItem({ tvShowId: 800, avgRuntime: 30 })]
    const watchedMap = new Map([[800, watched]])

    const { result } = renderHook(() =>
      useWatchProgressEnrichment(initial, watchedMap),
    )

    await waitFor(() => {
      expect((result.current.enrichedProgress[0].nextEpisode as any)?.title).toBe("S2E3")
    })

    expect(result.current.enrichedProgress[0]).toEqual(
      expect.objectContaining({
        tvShowId: 800,
        // 12 watched out of 20 total = 60%
        percentage: 60,
        // 3 unwatched aired episodes (3, 4, 5) * 30 min = 90 min
        timeRemaining: 90,
        nextEpisode: {
          kind: "unwatched",
          season: 2,
          episode: 3,
          title: "S2E3",
        },
      }),
    )
  })

  it("handles fallback heuristic for freshly-started continuous season when season-details query is pending", async () => {
    let resolveSeasonDetails!: (value: any) => void
    const pendingSeasonDetailsPromise = new Promise((resolve) => {
      resolveSeasonDetails = resolve
    })

    vi.mocked(fetchTVShowDetails).mockResolvedValue({
      id: 714,
      name: "Continuous Fresh Season Show",
      status: "Returning Series",
      number_of_episodes: 136,
      totalEpisodes: 136,
      avgRuntime: 30,
      seasons: [
        { season_number: 1, episode_count: 62, air_date: "2020-01-01" },
        { season_number: 2, episode_count: 74, air_date: "2026-03-01" },
      ],
      last_episode_to_air: {
        season_number: 2,
        episode_number: 65,
        air_date: "2026-03-05",
      },
      next_episode_to_air: null,
      genres: [],
      overview: "",
      poster_path: null,
      backdrop_path: null,
      first_air_date: "2020-01-01",
      last_air_date: "2026-03-05",
      number_of_seasons: 2,
      vote_average: 8,
      vote_count: 50,
    } as never)

    vi.mocked(fetchSeasonEpisodes).mockImplementation(() => pendingSeasonDetailsPromise as never)

    const watched = new Set([
      ...buildWatchedRangeKeys(1, 1, 62),
    ])

    const initial = [createBaseProgressItem({ tvShowId: 714, avgRuntime: 30 })]
    const watchedMap = new Map([[714, watched]])

    const { result } = renderHook(() =>
      useWatchProgressEnrichment(initial, watchedMap),
    )

    // 1 & 2: While season details query is still pending, verify fallback heuristic
    await waitFor(() => {
      expect(result.current.enrichedProgress[0].nextEpisode).toEqual({
        kind: "unwatched",
        season: 2,
        episode: 63,
        title: "Episode 63",
      })
    })

    // 3: Once season-details query resolves, verify result stays consistent (S2E63 with real title, no flicker)
    await act(async () => {
      resolveSeasonDetails([
        { id: 63, episode_number: 63, name: "S2 Ep 63 Real Title", air_date: "2026-03-01", runtime: 30 },
        { id: 64, episode_number: 64, name: "S2 Ep 64 Real Title", air_date: "2026-03-03", runtime: 30 },
        { id: 65, episode_number: 65, name: "S2 Ep 65 Real Title", air_date: "2026-03-05", runtime: 30 },
      ])
    })

    await waitFor(() => {
      expect(result.current.enrichedProgress[0].nextEpisode).toEqual({
        kind: "unwatched",
        season: 2,
        episode: 63,
        title: "S2 Ep 63 Real Title",
      })
    })
  })
})
