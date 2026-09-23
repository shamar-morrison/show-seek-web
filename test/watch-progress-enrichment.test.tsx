import { fetchSeasonEpisodes, fetchTVShowDetails } from "@/app/actions"
import { isContinuousNumbering, useWatchProgressEnrichment } from "@/hooks/use-watch-progress-enrichment"
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
      expect((result.current.enrichedProgress[0].nextEpisode as { title?: string })?.title).toBe("Insane x Inquest")
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
      expect((result.current.enrichedProgress[0].nextEpisode as { title?: string })?.title).toBe("S2 Premiere")
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
      expect((result.current.enrichedProgress[0].nextEpisode as { title?: string })?.title).toBe("S3E3")
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
      expect((result.current.enrichedProgress[0].nextEpisode as { title?: string })?.title).toBe("S2E3")
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
    let resolveSeasonDetails!: (value: unknown) => void
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

  it("treats standard show with later season episode exceeding prior count as standard 1-based numbering when season details pending", async () => {
    let resolveSeasonDetails!: (value: unknown) => void
    const pendingSeasonDetailsPromise = new Promise((resolve) => {
      resolveSeasonDetails = resolve
    })

    vi.mocked(fetchTVShowDetails).mockResolvedValue({
      id: 805,
      name: "Standard Small Seasons Show",
      status: "Returning Series",
      number_of_episodes: 25,
      totalEpisodes: 25,
      avgRuntime: 30,
      seasons: [
        { season_number: 1, episode_count: 5, air_date: "2025-01-01" },
        { season_number: 2, episode_count: 20, air_date: "2026-03-01" },
      ],
      last_episode_to_air: {
        season_number: 2,
        episode_number: 6,
        air_date: "2026-03-08",
      },
      next_episode_to_air: null,
      genres: [],
      overview: "",
      poster_path: null,
      backdrop_path: null,
      first_air_date: "2025-01-01",
      last_air_date: "2026-03-08",
      number_of_seasons: 2,
      vote_average: 8,
      vote_count: 50,
    } as never)

    vi.mocked(fetchSeasonEpisodes).mockImplementation(() => pendingSeasonDetailsPromise as never)

    const watched = new Set([
      ...buildWatchedRangeKeys(1, 1, 5),
    ])

    const initial = [createBaseProgressItem({ tvShowId: 805, avgRuntime: 30 })]
    const watchedMap = new Map([[805, watched]])

    const { result } = renderHook(() =>
      useWatchProgressEnrichment(initial, watchedMap),
    )

    await waitFor(() => {
      expect(result.current.enrichedProgress[0].nextEpisode).toEqual({
        kind: "unwatched",
        season: 2,
        episode: 1,
        title: "Episode 1",
      })
    })

    // Verify standard 1-based progress calculation (isContinuous === false):
    // - totalAiredEpisodes = 5 (S1) + 6 (S2) = 11
    // - remainingAiredEpisodes = 6 (S2 eps 1-6)
    // - timeRemaining = 6 * 30 min = 180 min
    // - percentage = 5 / 25 = 20%
    expect(result.current.enrichedProgress[0]).toEqual(
      expect.objectContaining({
        tvShowId: 805,
        percentage: 20,
        timeRemaining: 180,
        nextEpisode: {
          kind: "unwatched",
          season: 2,
          episode: 1,
          title: "Episode 1",
        },
      }),
    )

    // Cleanup promise
    await act(async () => {
      resolveSeasonDetails([])
    })
  })

  it("evaluates pending window behavior for standard show with large season count (S1=30, S2=40, S2E35)", async () => {
    let resolveSeasonDetails!: (value: unknown) => void
    const pendingSeasonDetailsPromise = new Promise((resolve) => {
      resolveSeasonDetails = resolve
    })

    vi.mocked(fetchTVShowDetails).mockResolvedValue({
      id: 806,
      name: "Large Standard Show",
      status: "Returning Series",
      number_of_episodes: 70,
      totalEpisodes: 70,
      avgRuntime: 30,
      seasons: [
        { season_number: 1, episode_count: 30, air_date: "2024-01-01" },
        { season_number: 2, episode_count: 40, air_date: "2026-03-01" },
      ],
      last_episode_to_air: {
        season_number: 2,
        episode_number: 35,
        air_date: "2026-03-08",
      },
      next_episode_to_air: null,
      genres: [],
      overview: "",
      poster_path: null,
      backdrop_path: null,
      first_air_date: "2024-01-01",
      last_air_date: "2026-03-08",
      number_of_seasons: 2,
      vote_average: 8,
      vote_count: 50,
    } as never)

    vi.mocked(fetchSeasonEpisodes).mockImplementation(() => pendingSeasonDetailsPromise as never)

    const watched = new Set([
      ...buildWatchedRangeKeys(1, 1, 30),
    ])

    const initial = [createBaseProgressItem({ tvShowId: 806, avgRuntime: 30 })]
    const watchedMap = new Map([[806, watched]])

    const { result } = renderHook(() =>
      useWatchProgressEnrichment(initial, watchedMap),
    )

    // During pending window: fallback heuristic flags continuous (35 > 30 && 30 >= 30), guessing S2E31
    await waitFor(() => {
      expect(result.current.enrichedProgress[0].nextEpisode).toEqual({
        kind: "unwatched",
        season: 2,
        episode: 31,
        title: "Episode 31",
      })
    })

    expect(result.current.enrichedProgress[0]).toEqual(
      expect.objectContaining({
        tvShowId: 806,
        percentage: 43,
        timeRemaining: 150, // 5 unwatched (31-35) * 30 min
        nextEpisode: {
          kind: "unwatched",
          season: 2,
          episode: 31,
          title: "Episode 31",
        },
      }),
    )

    // Resolve season details with real TMDB 1-based episodes 1..35
    const realEpisodes: Array<Record<string, unknown>> = []
    for (let ep = 1; ep <= 35; ep++) {
      realEpisodes.push({
        id: ep,
        season_number: 2,
        episode_number: ep,
        name: ep === 1 ? "S2E1 Real Title" : `Episode ${ep}`,
        air_date: "2026-03-08",
        runtime: 30,
      })
    }

    await act(async () => {
      resolveSeasonDetails(realEpisodes)
    })

    // Once resolved, Signal 1 overrides: self-corrects to S2E1 with 35 unwatched (1050 min)
    await waitFor(() => {
      expect(result.current.enrichedProgress[0]).toEqual(
        expect.objectContaining({
          tvShowId: 806,
          percentage: 43,
          timeRemaining: 1050,
          nextEpisode: {
            kind: "unwatched",
            season: 2,
            episode: 1,
            title: "S2E1 Real Title",
          },
        }),
      )
    })
  })

  it("does not lock isContinuous to false when target is Season 1 and later season carries continuation evidence", async () => {
    vi.mocked(fetchTVShowDetails).mockResolvedValue({
      id: 901,
      name: "Continuous Show S1 Active",
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
        air_date: "2026-03-08",
      },
      next_episode_to_air: null,
      genres: [],
      overview: "",
      poster_path: null,
      backdrop_path: null,
      first_air_date: "2020-01-01",
      last_air_date: "2026-03-08",
      number_of_seasons: 2,
      vote_average: 8,
      vote_count: 50,
    } as never)

    // S1 details loaded (begins at episode 1)
    const s1Episodes: Array<Record<string, unknown>> = []
    for (let ep = 1; ep <= 62; ep++) {
      s1Episodes.push({
        id: ep,
        season_number: 1,
        episode_number: ep,
        name: `S1 Episode ${ep}`,
        air_date: "2020-01-01",
        runtime: 30,
      })
    }
    vi.mocked(fetchSeasonEpisodes).mockImplementation(async (_showId, seasonNum) => {
      if (seasonNum === 1) return s1Episodes as never
      return [] as never
    })

    const watched = new Set([
      ...buildWatchedRangeKeys(1, 1, 10),
    ])

    const initial = [createBaseProgressItem({ tvShowId: 901, avgRuntime: 30 })]
    const watchedMap = new Map([[901, watched]])

    const { result } = renderHook(() =>
      useWatchProgressEnrichment(initial, watchedMap),
    )

    await waitFor(() => {
      expect(result.current.enrichedProgress[0].nextEpisode).toEqual({
        kind: "unwatched",
        season: 1,
        episode: 11,
        title: "S1 Episode 11",
      })
    })

    // Verify S1 details starting at 1 did not lock isContinuous to false:
    // With isContinuous = true:
    // - totalAiredEpisodes = 65 (62 in S1 + 3 in S2: 63, 64, 65)
    // - remainingAiredEpisodes = 52 (S1 unwatched: 11-62) + 3 (S2 continuous unwatched: 63-65) = 55
    // - timeRemaining = 55 * 30 = 1650 min (NOT 117 * 30 = 3510 min from false standard scanning)
    expect(result.current.enrichedProgress[0]).toEqual(
      expect.objectContaining({
        tvShowId: 901,
        percentage: 7, // 10 watched / 136 total
        timeRemaining: 1650,
        nextEpisode: {
          kind: "unwatched",
          season: 1,
          episode: 11,
          title: "S1 Episode 11",
        },
      }),
    )
  })

  it("correctly short-circuits to false when loaded Season 2 data begins at episode 1", async () => {
    vi.mocked(fetchTVShowDetails).mockResolvedValue({
      id: 902,
      name: "Standard Show Loaded S2",
      status: "Returning Series",
      number_of_episodes: 30,
      totalEpisodes: 30,
      avgRuntime: 30,
      seasons: [
        { season_number: 1, episode_count: 10, air_date: "2025-01-01" },
        { season_number: 2, episode_count: 20, air_date: "2026-03-01" },
      ],
      last_episode_to_air: {
        season_number: 2,
        episode_number: 6,
        air_date: "2026-03-08",
      },
      next_episode_to_air: null,
      genres: [],
      overview: "",
      poster_path: null,
      backdrop_path: null,
      first_air_date: "2025-01-01",
      last_air_date: "2026-03-08",
      number_of_seasons: 2,
      vote_average: 8,
      vote_count: 50,
    } as never)

    // S2 details loaded and starts at episode 1
    vi.mocked(fetchSeasonEpisodes).mockResolvedValue([
      { id: 1, episode_number: 1, name: "S2 Premiere", air_date: "2026-03-01", runtime: 30 },
      { id: 2, episode_number: 2, name: "S2 Episode 2", air_date: "2026-03-02", runtime: 30 },
      { id: 3, episode_number: 3, name: "S2 Episode 3", air_date: "2026-03-03", runtime: 30 },
      { id: 4, episode_number: 4, name: "S2 Episode 4", air_date: "2026-03-04", runtime: 30 },
      { id: 5, episode_number: 5, name: "S2 Episode 5", air_date: "2026-03-05", runtime: 30 },
      { id: 6, episode_number: 6, name: "S2 Episode 6", air_date: "2026-03-08", runtime: 30 },
    ] as never)

    const watched = new Set([
      ...buildWatchedRangeKeys(1, 1, 10),
    ])

    const initial = [createBaseProgressItem({ tvShowId: 902, avgRuntime: 30 })]
    const watchedMap = new Map([[902, watched]])

    const { result } = renderHook(() =>
      useWatchProgressEnrichment(initial, watchedMap),
    )

    await waitFor(() => {
      expect(result.current.enrichedProgress[0].nextEpisode).toEqual({
        kind: "unwatched",
        season: 2,
        episode: 1,
        title: "S2 Premiere",
      })
    })

    // Verify S2 beginning at 1 short-circuits isContinuous to false:
    expect(result.current.enrichedProgress[0]).toEqual(
      expect.objectContaining({
        tvShowId: 902,
        percentage: 33, // 10 watched / 30 total
        timeRemaining: 180, // 6 unwatched aired (1-6) * 30 min
        nextEpisode: {
          kind: "unwatched",
          season: 2,
          episode: 1,
          title: "S2 Premiere",
        },
      }),
    )
  })

  it("detects continuous numbering via unconditional current-season-count check when target is S1 and lastAired is in S3", async () => {
    // Direct check: Verify isContinuousNumbering evaluates true regardless of target season
    expect(
      isContinuousNumbering(
        [
          [1, 62],
          [2, 74],
          [3, 12],
        ],
        { seasonNumber: 3, episodeNumber: 148 },
        new Set(),
        new Map(),
        1, // target season 1
      ),
    ).toBe(true)

    expect(
      isContinuousNumbering(
        [
          [1, 62],
          [2, 74],
          [3, 12],
        ],
        { seasonNumber: 3, episodeNumber: 148 },
        new Set(),
        new Map(),
        2, // target season 2
      ),
    ).toBe(true)

    vi.mocked(fetchTVShowDetails).mockResolvedValue({
      id: 903,
      name: "Continuous Multi-Season Show",
      status: "Returning Series",
      number_of_episodes: 148,
      totalEpisodes: 148,
      avgRuntime: 30,
      seasons: [
        { season_number: 1, episode_count: 62, air_date: "2020-01-01" },
        { season_number: 2, episode_count: 74, air_date: "2022-01-01" },
        { season_number: 3, episode_count: 12, air_date: "2026-03-01" },
      ],
      last_episode_to_air: {
        season_number: 3,
        episode_number: 148,
        air_date: "2026-03-08",
      },
      next_episode_to_air: null,
      genres: [],
      overview: "",
      poster_path: null,
      backdrop_path: null,
      first_air_date: "2020-01-01",
      last_air_date: "2026-03-08",
      number_of_seasons: 3,
      vote_average: 9,
      vote_count: 1000,
    } as never)

    // S1 details loaded (begins at episode 1, 62 episodes)
    const s1Episodes: Array<Record<string, unknown>> = []
    for (let ep = 1; ep <= 62; ep++) {
      s1Episodes.push({
        id: ep,
        season_number: 1,
        episode_number: ep,
        name: `S1 Episode ${ep}`,
        air_date: "2020-01-01",
        runtime: 30,
      })
    }
    vi.mocked(fetchSeasonEpisodes).mockImplementation(async (_showId, seasonNum) => {
      if (seasonNum === 1) return s1Episodes as never
      return [] as never
    })

    const watched = new Set([
      ...buildWatchedRangeKeys(1, 1, 10),
    ])

    const initial = [createBaseProgressItem({ tvShowId: 903, avgRuntime: 30 })]
    const watchedMap = new Map([[903, watched]])

    const { result } = renderHook(() =>
      useWatchProgressEnrichment(initial, watchedMap),
    )

    await waitFor(() => {
      expect(result.current.enrichedProgress[0].nextEpisode).toEqual({
        kind: "unwatched",
        season: 1,
        episode: 11,
        title: "S1 Episode 11",
      })
    })

    // Verify continuous detection via definitive proof (148 > 12):
    // - totalAiredEpisodes = 148
    // - remainingAiredEpisodes: S1 (52: 11-62) + S2 continuous (74: 63-136) + S3 continuous (12: 137-148) = 138
    // - timeRemaining = 138 * 30 min = 4140 min
    expect(result.current.enrichedProgress[0]).toEqual(
      expect.objectContaining({
        tvShowId: 903,
        percentage: 7, // 10 watched / 148 total
        timeRemaining: 4140,
        nextEpisode: {
          kind: "unwatched",
          season: 1,
          episode: 11,
          title: "S1 Episode 11",
        },
      }),
    )
  })

  it("marks a show as isUnavailable when TMDB details return not_found (404)", async () => {
    vi.mocked(fetchTVShowDetails).mockResolvedValue({
      status: "not_found",
    })

    const initialShow = createBaseProgressItem({
      tvShowId: 306684,
      tvShowName: "Dead TMDB Show",
      watchedCount: 12,
      totalEpisodes: 0,
      nextEpisode: {
        kind: "unwatched",
        season: 1,
        episode: 13,
        title: "Episode 13",
      },
    })

    const watchedEpisodes = new Map<number, Set<string>>([
      [306684, new Set(buildWatchedRangeKeys(1, 1, 12))],
    ])

    const initial = [initialShow]
    const { result } = renderHook(() =>
      useWatchProgressEnrichment(initial, watchedEpisodes),
    )

    await waitFor(() => {
      expect(result.current.enrichedProgress[0].isUnavailable).toBe(true)
    })

    expect(result.current.enrichedProgress[0]).toEqual(
      expect.objectContaining({
        tvShowId: 306684,
        isUnavailable: true,
        percentage: 0,
        timeRemaining: 0,
        nextEpisode: null,
      }),
    )
  })

  it("does NOT mark a show as isUnavailable when TMDB details fail with a transient error (500)", async () => {
    vi.mocked(fetchTVShowDetails).mockResolvedValue({
      status: "error",
      error: new Error("500 Internal Server Error"),
    })

    const initialShow = createBaseProgressItem({
      tvShowId: 101,
      tvShowName: "Healthy Show",
      percentage: 50,
      timeRemaining: 180,
      nextEpisode: {
        kind: "unwatched",
        season: 1,
        episode: 5,
        title: "Episode 5",
      },
    })

    const watchedEpisodes = new Map<number, Set<string>>([
      [101, new Set(buildWatchedRangeKeys(1, 1, 4))],
    ])

    const initial = [initialShow]
    const { result } = renderHook(() =>
      useWatchProgressEnrichment(initial, watchedEpisodes),
    )

    // Wait for fetchTVShowDetails to be called
    await waitFor(() => {
      expect(fetchTVShowDetails).toHaveBeenCalledWith(101)
    })

    // Must NOT be marked isUnavailable, retains initial state
    expect(result.current.enrichedProgress[0].isUnavailable).toBeUndefined()
    expect(result.current.enrichedProgress[0].percentage).toBe(50)
    expect(result.current.enrichedProgress[0].timeRemaining).toBe(180)
    expect(result.current.enrichedProgress[0].nextEpisode).toEqual({
      kind: "unwatched",
      season: 1,
      episode: 5,
      title: "Episode 5",
    })
  })
})
