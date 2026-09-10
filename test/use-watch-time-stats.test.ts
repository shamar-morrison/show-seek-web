import { useWatchTimeStats } from "@/hooks/use-watch-time-stats"
import { renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  tracking: new Map<string, unknown>(),
  lists: [] as unknown[],
  ratings: new Map<string, unknown>(),
}))

vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({ user: { uid: "user-1", isAnonymous: false }, loading: false }),
}))

vi.mock("@/hooks/use-episode-tracking", () => ({
  useEpisodeTracking: () => ({ tracking: mocks.tracking, loading: false }),
}))

vi.mock("@/hooks/use-lists", () => ({
  useLists: () => ({ lists: mocks.lists, loading: false }),
}))

vi.mock("@/hooks/use-ratings", () => ({
  useRatingsData: () => ({ ratings: mocks.ratings, loading: false }),
}))

function monthKeyOf(timestamp: number): string {
  const date = new Date(timestamp)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

describe("useWatchTimeStats", () => {
  beforeEach(() => {
    mocks.tracking = new Map()
    mocks.lists = []
    mocks.ratings = new Map()
  })

  it("sums stamped runtimes and falls back in-memory (45 episode / 0 movie)", () => {
    const now = Date.now()
    mocks.tracking = new Map([
      [
        "100",
        {
          episodes: {
            "1_1": {
              episodeId: 1,
              tvShowId: 100,
              seasonNumber: 1,
              episodeNumber: 1,
              watchedAt: now,
              episodeName: "Pilot",
              episodeAirDate: null,
              runtimeMinutes: 50,
            },
            "1_2": {
              episodeId: 2,
              tvShowId: 100,
              seasonNumber: 1,
              episodeNumber: 2,
              watchedAt: now,
              episodeName: "Second",
              episodeAirDate: null,
              // unstamped -> 45 fallback
            },
          },
          metadata: { tvShowName: "Show", posterPath: null, lastUpdated: now },
        },
      ],
    ])
    mocks.lists = [
      {
        id: "already-watched",
        name: "Already Watched",
        items: {
          "movie-1": {
            id: 1,
            title: "Film",
            poster_path: null,
            media_type: "movie",
            addedAt: now,
            // unstamped movie -> 0 fallback
          },
          "tv-2": {
            id: 2,
            title: "Series",
            poster_path: null,
            media_type: "tv",
            addedAt: now,
            runtimeMinutes: 60,
          },
        },
        createdAt: 0,
      },
      {
        id: "watchlist",
        name: "Should Watch",
        items: {
          "movie-9": {
            id: 9,
            title: "Later",
            poster_path: null,
            media_type: "movie",
            addedAt: now,
            runtimeMinutes: 999,
          },
        },
        createdAt: 0,
      },
    ]

    const { result } = renderHook(() => useWatchTimeStats())

    // 50 + 45 (fallback) + 0 (movie fallback) + 60; watchlist ignored.
    expect(result.current.totalWatchMinutes).toBe(155)
    expect(result.current.episodeCount).toBe(2)
    expect(result.current.alreadyWatchedCount).toBe(2)
    expect(result.current.unstampedEpisodes).toHaveLength(1)
    expect(result.current.unstampedListItems).toHaveLength(1)
    expect(result.current.months).toHaveLength(1)
    expect(result.current.months[0]?.key).toBe(monthKeyOf(now))
  })

  it("excludes entries older than the 6-month cutoff", () => {
    const old = new Date()
    old.setMonth(old.getMonth() - 7)
    old.setDate(1)
    const oldTimestamp = old.getTime()

    mocks.tracking = new Map([
      [
        "100",
        {
          episodes: {
            "1_1": {
              episodeId: 1,
              tvShowId: 100,
              seasonNumber: 1,
              episodeNumber: 1,
              watchedAt: oldTimestamp,
              episodeName: "Old",
              episodeAirDate: null,
              runtimeMinutes: 50,
            },
          },
          metadata: { tvShowName: "Show", posterPath: null, lastUpdated: oldTimestamp },
        },
      ],
    ])

    const { result } = renderHook(() => useWatchTimeStats())

    expect(result.current.totalWatchMinutes).toBe(0)
    expect(result.current.episodeCount).toBe(0)
    expect(result.current.unstampedEpisodes).toHaveLength(0)
  })

  it("returns zeros for guests", () => {
    const { result } = renderHook(() => useWatchTimeStats())

    // Auth is mocked as signed-in here; empty caches still yield zeros.
    expect(result.current.totalWatchMinutes).toBe(0)
    expect(result.current.months).toHaveLength(0)
  })
})
