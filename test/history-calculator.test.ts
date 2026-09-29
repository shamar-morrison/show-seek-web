import { describe, it, expect, vi } from "vitest"
import { HistoryCalculator, type HistorySource } from "@/lib/history/calculator"
import {
  normalizeHistoryDocuments,
  type HistoryDocument,
} from "@/lib/history/source"
import { normalizeEpisodeTrackingDoc } from "@/lib/history/episode-normalization"
import { computeProfileWatchTime } from "@/lib/profile-watch-time"
import { isHistoryMonth } from "@/lib/history/month"
import { toMillis } from "@/lib/history/timestamps"

const stamp = (month: number, day: number, hour = 12) =>
  new Date(2026, month - 1, day, hour).getTime()
const now = stamp(3, 9)
const doc = (id: string, data: Record<string, unknown>): HistoryDocument => ({
  id,
  data,
})
const empty = (): HistorySource => ({ episodes: [], lists: [], ratings: [] })
const trackingDoc = doc("500", {
  metadata: { tvShowName: "Grouped Show", posterPath: "/grouped-show.jpg" },
  episodes: {
    "1_1": {
      tvShowId: 500,
      seasonNumber: 1,
      episodeNumber: 1,
      watchedAt: stamp(3, 3),
      runtimeMinutes: 42,
    },
    "1_2": {
      tvShowId: 500,
      seasonNumber: 1,
      episodeNumber: 2,
      watchedAt: stamp(3, 7),
    },
  },
})
const listDoc = doc("already-watched", {
  name: "Already Watched",
  items: {
    "movie-101": {
      id: 101,
      media_type: "movie",
      title: "Watched Movie",
      poster_path: "/movie.jpg",
      addedAt: stamp(3, 6),
      runtimeMinutes: 120,
    },
    "tv-500": {
      id: 500,
      media_type: "tv",
      name: "Grouped Show",
      poster_path: "/show.jpg",
      addedAt: stamp(3, 4),
    },
  },
})
function mobileFixture(): HistorySource {
  return {
    episodes: normalizeHistoryDocuments("episodes", [trackingDoc]),
    ratings: [],
    lists: normalizeHistoryDocuments("lists", [listDoc]),
  }
}

describe("mobile history parity", () => {
  it("ports the mobile stamped/fallback fixture: 252 minutes and four watches", () => {
    const source = mobileFixture()
    const calculator = new HistoryCalculator(source, now)
    const overview = calculator.overview({})
    const detail = calculator.detail("2026-03", {})
    expect(overview.totalWatchMinutes).toBe(252)
    expect(overview.totalWatched).toBe(4)
    expect(overview.watchedSplit).toEqual({
      movies: 1,
      tvShows: 2,
      tvEpisodes: 2,
    })
    expect(detail.stats.totalWatchMinutes).toBe(252)
    expect(detail.items.watched.map((item) => [item.kind, item.id])).toEqual([
      ["episode-group", 500],
      ["media", 101],
      ["media", 500],
    ])
    expect(detail.items.watched[0]).toMatchObject({
      episodeCount: 2,
      timestamp: stamp(3, 7),
    })
    const normalized = normalizeEpisodeTrackingDoc(
      trackingDoc.data,
      trackingDoc.id,
    )!
    expect(
      computeProfileWatchTime(
        new Map([["500", normalized]]),
        source.lists,
        now,
      ),
    ).toBe(overview.totalWatchMinutes)
  })
  it("keeps raw list entries in overview but deduplicates month detail by media type and id", () => {
    const source = mobileFixture()
    source.lists.push(
      ...normalizeHistoryDocuments("lists", [
        doc("legacy-custom", {
          name: "Legacy",
          items: {
            duplicate: {
              id: 101,
              media_type: "movie",
              title: "Duplicate",
              addedAt: stamp(3, 8),
              genre_ids: [1],
            },
            tv: {
              id: 101,
              media_type: "tv",
              name: "Different type",
              addedAt: stamp(3, 8),
              genre_ids: [2],
            },
          },
        }),
      ]),
    )
    const c = new HistoryCalculator(source, now)
    expect(c.overview({}).totalAddedToLists).toBe(4)
    expect(c.detail("2026-03", {}).stats.addedToLists).toBe(3)
    expect(
      c
        .detail("2026-03", {})
        .items.added.find(
          (item) => item.id === 101 && item.mediaType === "movie",
        )?.title,
    ).toBe("Watched Movie")
  })
  it("does not collapse legacy and typed item keys in the same list", () => {
    const source = empty()
    source.lists = normalizeHistoryDocuments("lists", [
      doc("already-watched", {
        name: "Watched",
        items: {
          "101": {
            id: 101,
            media_type: "movie",
            addedAt: stamp(3, 4),
            runtimeMinutes: 90,
          },
          "movie-101": {
            id: 101,
            media_type: "movie",
            addedAt: stamp(3, 5),
            runtimeMinutes: 90,
          },
        },
      }),
    ])
    expect(new HistoryCalculator(source, now).overview({})).toMatchObject({
      totalWatched: 2,
      totalWatchMinutes: 180,
      totalAddedToLists: 2,
    })
  })
  it("accepts mobile legacy timestamps and episode identifiers and rejects malformed keys", () => {
    const docs = [
      doc("500", {
        episodes: {
          "1_1": {
            watchedAt: { toMillis: () => stamp(3, 1) },
            runtimeMinutes: "42",
          },
          "0_1": { watchedAt: String(stamp(3, 2)), runtimeMinutes: 42.5 },
          "1_3": { watchedAt: new Date(stamp(3, 3)).toISOString() },
          bad: { watchedAt: stamp(3, 4) },
          "1_0": { watchedAt: stamp(3, 4) },
        },
      }),
    ]
    const episodes = normalizeHistoryDocuments("episodes", docs)
    expect(episodes).toHaveLength(3)
    expect(episodes[0]).toMatchObject({
      tvShowId: 500,
      episodeNumber: 1,
      runtimeMinutes: 42,
    })
    expect(episodes[1].runtimeMinutes).toBeUndefined()
    expect(
      new HistoryCalculator({ ...empty(), episodes }, now).overview({})
        .totalWatchMinutes,
    ).toBe(132)
    expect(toMillis({ toDate: () => new Date(stamp(3, 2)) })).toBe(stamp(3, 2))
    expect(toMillis("bad date")).toBeNull()
  })
  it("uses the first day six months ago, includes the boundary, and compares populated months", () => {
    const source = empty()
    const cutoff = new Date(2025, 8, 1).getTime()
    source.ratings = normalizeHistoryDocuments("ratings", [
      doc("movie-1", { mediaType: "movie", rating: 8, ratedAt: cutoff - 1 }),
      doc("movie-2", { mediaType: "movie", rating: 8, ratedAt: cutoff }),
      doc("movie-3", { mediaType: "movie", rating: 9, ratedAt: stamp(3, 1) }),
      doc("movie-4", { mediaType: "movie", rating: 9, ratedAt: stamp(3, 2) }),
    ])
    const c = new HistoryCalculator(source, now)
    const result = c.overview({})
    expect(result.totalRated).toBe(3)
    expect(result.monthlyStats.map((m) => m.month)).toEqual([
      "2026-03",
      "2025-09",
    ])
    expect(result.monthlyStats[0].comparisonToPrevious).toEqual({
      rated: 100,
      watched: 0,
      addedToLists: 0,
    })
    expect(result.monthlyStats[1].comparisonToPrevious).toBeNull()
    expect(c.detail("2026-02", {}).items.rated).toEqual([])
  })
  it("matches the mobile late-August cutoff regression", () => {
    const source = empty()
    source.lists = normalizeHistoryDocuments("lists", [
      doc("already-watched", {
        name: "Watched",
        items: {
          a: {
            id: 1,
            media_type: "movie",
            addedAt: stamp(2, 15),
            runtimeMinutes: 120,
          },
        },
      }),
    ])
    expect(
      new HistoryCalculator(source, stamp(8, 31)).overview({})
        .totalWatchMinutes,
    ).toBe(120)
  })
  it("uses inclusive local month boundaries and mobile rating normalization for every type", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {})
    const source = empty()
    source.ratings = normalizeHistoryDocuments("ratings", [
      doc("movie-101", {
        mediaType: "movie",
        rating: "8",
        ratedAt: new Date(2026, 2, 1).getTime(),
      }),
      doc("tv-202", {
        mediaType: "tv",
        rating: 7,
        ratedAt: { toMillis: () => new Date(2026, 3, 1).getTime() - 1 },
      }),
      doc("season-404-3", {
        mediaType: "season",
        rating: 9,
        ratedAt: stamp(3, 5),
        tvShowId: 404,
        seasonNumber: 3,
      }),
      doc("episode-404-3-1", {
        mediaType: "episode",
        rating: 8,
        ratedAt: stamp(3, 5),
      }),
      doc("bad", { mediaType: "movie", ratedAt: stamp(3, 5) }),
      doc("outside", {
        mediaType: "tv",
        rating: 10,
        ratedAt: new Date(2026, 3, 1).getTime(),
      }),
    ])
    const detail = new HistoryCalculator(source, now).detail("2026-03", {})
    expect(detail.stats).toMatchObject({
      rated: 4,
      averageRating: 8,
      ratedSplit: { movies: 1, tvShows: 3, tvEpisodes: 1 },
    })
    expect(
      detail.items.rated.find((item) => item.mediaType === "season"),
    ).toMatchObject({ title: "Season 3", id: "season-404-3" })
  })
  it("keeps genre ties in insertion order and counts genres from additions only", () => {
    const source = empty()
    source.lists = normalizeHistoryDocuments("lists", [
      doc("watchlist", {
        name: "Watchlist",
        items: {
          a: {
            id: 1,
            media_type: "movie",
            addedAt: stamp(3, 3),
            genre_ids: [3, 2, 1, 4],
          },
        },
      }),
    ])
    expect(
      new HistoryCalculator(source, now).overview({
        1: "Drama",
        2: "Comedy",
        3: "Action",
        4: "Horror",
      }).monthlyStats[0].topGenres,
    ).toEqual(["Action", "Comedy", "Drama"])
  })
  it("calculates streaks from all activity and keeps first-encountered pattern ties", () => {
    const source = empty()
    source.ratings = [7, 8, 9].map((day) => ({
      id: String(day),
      mediaType: "movie",
      rating: 8,
      ratedAt: stamp(3, day, 18),
    }))
    const result = new HistoryCalculator(source, now).overview({})
    expect(result).toMatchObject({
      currentStreak: 3,
      longestStreak: 3,
      mostActiveTimeOfDay: "Evening",
    })
    expect(result.mostActiveDay).toBe(
      new Date(stamp(3, 7)).toLocaleDateString("en-US", { weekday: "long" }),
    )
    expect(
      new HistoryCalculator(source, stamp(3, 10)).overview({}).currentStreak,
    ).toBe(3)
    expect(
      new HistoryCalculator(source, stamp(3, 11)).overview({}).currentStreak,
    ).toBe(0)
  })
  it("handles zero-baseline comparisons and empty histories", () => {
    const source = mobileFixture()
    source.ratings = [
      { id: "1", mediaType: "movie", rating: 7, ratedAt: stamp(1, 1) },
    ]
    expect(
      new HistoryCalculator(source, now).overview({}).monthlyStats[0]
        .comparisonToPrevious,
    ).toEqual({ watched: 100, rated: -100, addedToLists: 100 })
    expect(new HistoryCalculator(empty(), now).overview({})).toMatchObject({
      monthlyStats: [],
      currentStreak: 0,
      longestStreak: 0,
      totalWatchMinutes: 0,
      mostActiveDay: null,
    })
  })
  it("validates month routes", () => {
    expect(isHistoryMonth("2026-03")).toBe(true)
    for (const month of ["2026-13", "2026-00", "2026-3", "oops", "0000-01"])
      expect(isHistoryMonth(month)).toBe(false)
  })
})
