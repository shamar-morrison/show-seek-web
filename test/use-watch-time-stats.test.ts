import { useWatchTimeStats } from "@/hooks/use-watch-time-stats"
import {
  analyzePatterns,
  calculatePercentageChange,
  calculateStreaks,
  calculateTopGenres,
} from "@/hooks/use-watch-time-stats"
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

  it("computes streaks from consecutive active days", () => {
    const day = 24 * 60 * 60 * 1000
    const now = Date.now()

    expect(calculateStreaks([])).toEqual({ current: 0, longest: 0 })
    expect(calculateStreaks([now, now - day, now - 2 * day])).toEqual({
      current: 3,
      longest: 3,
    })
    // Gap breaks the longest run but yesterday keeps current alive.
    expect(
      calculateStreaks([now, now - day, now - 5 * day, now - 6 * day]),
    ).toEqual({ current: 2, longest: 2 })
    // Stale activity yields no current streak but keeps the longest.
    expect(calculateStreaks([now - 10 * day, now - 11 * day])).toEqual({
      current: 0,
      longest: 2,
    })
  })

  it("detects the most active weekday and time of day", () => {
    // Saturday 2026-09-05 20:00 local.
    const saturdayEvening = new Date(2026, 8, 5, 20, 0, 0).getTime()
    const saturdayMorning = new Date(2026, 8, 5, 9, 0, 0).getTime()
    const sundayNight = new Date(2026, 8, 6, 23, 0, 0).getTime()

    expect(analyzePatterns([])).toEqual({
      mostActiveDay: null,
      mostActiveTimeOfDay: null,
    })
    expect(
      analyzePatterns([saturdayEvening, saturdayMorning, sundayNight]),
    ).toEqual({ mostActiveDay: "Saturday", mostActiveTimeOfDay: "Evening" })
  })

  it("computes month-over-month percentage change", () => {
    expect(calculatePercentageChange(150, 100)).toBe(50)
    expect(calculatePercentageChange(50, 100)).toBe(-50)
    expect(calculatePercentageChange(0, 0)).toBe(0)
    expect(calculatePercentageChange(5, 0)).toBe(100)
    expect(calculatePercentageChange(0, 5)).toBe(-100)
  })

  it("picks the top 3 genre names and drops unknown ids", () => {
    const counts = new Map([
      [28, 5],
      [12, 3],
      [16, 2],
    ])
    expect(
      calculateTopGenres(counts, { 28: "Action", 12: "Adventure", 16: "Animation" }),
    ).toEqual(["Action", "Adventure", "Animation"])
    // Unknown ids are dropped (limit applies before the name lookup).
    expect(calculateTopGenres(new Map([[99, 9]]), {})).toEqual([])
  })

  it("exposes month comparison, average rating, and top genres", () => {
    const now = new Date()
    const prev = new Date(now)
    prev.setMonth(prev.getMonth() - 1)

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
              watchedAt: now.getTime(),
              episodeName: "Now",
              episodeAirDate: null,
              runtimeMinutes: 50,
            },
            "1_2": {
              episodeId: 2,
              tvShowId: 100,
              seasonNumber: 1,
              episodeNumber: 2,
              watchedAt: prev.getTime(),
              episodeName: "Before",
              episodeAirDate: null,
              runtimeMinutes: 50,
            },
          },
          metadata: { tvShowName: "Show", posterPath: null, lastUpdated: now.getTime() },
        },
      ],
    ])
    mocks.lists = [
      {
        id: "watchlist",
        name: "Should Watch",
        items: {
          "movie-9": {
            id: 9,
            title: "Later",
            poster_path: null,
            media_type: "movie",
            addedAt: now.getTime(),
            genre_ids: [28, 12],
          },
        },
        createdAt: 0,
      },
    ]
    mocks.ratings = new Map([
      [
        "movie-1",
        {
          id: "movie-1",
          mediaId: "1",
          mediaType: "movie",
          rating: 8,
          title: "Film",
          posterPath: null,
          releaseDate: null,
          ratedAt: now.getTime(),
        },
      ],
      [
        "movie-2",
        {
          id: "movie-2",
          mediaId: "2",
          mediaType: "movie",
          rating: 10,
          title: "Film 2",
          posterPath: null,
          releaseDate: null,
          ratedAt: now.getTime(),
        },
      ],
    ])

    const { result } = renderHook(() =>
      useWatchTimeStats({ genreMap: { 28: "Action", 12: "Adventure" } }),
    )

    expect(result.current.months).toHaveLength(2)
    const [current, previous] = result.current.months
    // Newest month: 1 episode watched; oldest is the comparison base.
    expect(current?.watched).toBe(1)
    expect(current?.comparisonToPrevious).toEqual({ watched: 0 })
    expect(previous?.comparisonToPrevious).toBeNull()
    expect(current?.averageRating).toBe(9)
    expect(current?.topGenres).toEqual(["Action", "Adventure"])
    expect(current?.rated).toHaveLength(2)
    expect(current?.added).toHaveLength(1)
  })
})
