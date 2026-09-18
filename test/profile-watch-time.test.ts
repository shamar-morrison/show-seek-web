import { formatWatchHours } from "@/lib/format-watch-time"
import {
  ALREADY_WATCHED_LIST_ID,
  EPISODE_RUNTIME_FALLBACK_MINUTES,
  computeProfileWatchTime,
  getMonthsAgoTimestamp,
} from "@/lib/profile-watch-time"
import type { TVShowEpisodeTracking } from "@/types/episode-tracking"
import type { ListMediaItem, UserList } from "@/types/list"
import { describe, expect, it } from "vitest"

// Fixed reference time so window edges are deterministic.
const NOW = new Date(2026, 8, 18, 12, 0, 0, 0).getTime()
const CUTOFF = getMonthsAgoTimestamp(6, NOW)

function trackingDoc(
  episodes: TVShowEpisodeTracking["episodes"],
): TVShowEpisodeTracking {
  return {
    episodes,
    metadata: {
      tvShowName: "Show",
      posterPath: null,
      lastUpdated: NOW,
    },
  }
}

function episode(overrides: Record<string, unknown> = {}) {
  return {
    episodeId: 1,
    tvShowId: 100,
    seasonNumber: 1,
    episodeNumber: 1,
    watchedAt: NOW,
    episodeName: "Pilot",
    episodeAirDate: null,
    ...overrides,
  }
}

function listDoc(
  id: string,
  items: UserList["items"],
): UserList {
  return {
    id,
    name: id,
    items,
    createdAt: 0,
  }
}

function listItem(overrides: Partial<ListMediaItem> = {}): ListMediaItem {
  return {
    id: 200,
    title: "Movie",
    poster_path: null,
    media_type: "movie",
    addedAt: NOW,
    ...overrides,
  }
}

describe("computeProfileWatchTime", () => {
  it("sums stamped episode runtimes inside the window", () => {
    const tracking = new Map([
      [
        "100",
        trackingDoc({
          "1_1": episode({ runtimeMinutes: 42 }),
          "1_2": episode({ episodeNumber: 2, runtimeMinutes: 50 }),
        }),
      ],
    ])

    expect(computeProfileWatchTime(tracking, [], NOW)).toBe(92)
  })

  it("counts window edges inclusively (watchedAt/addedAt >= cutoff)", () => {
    const tracking = new Map([
      [
        "100",
        trackingDoc({
          "1_1": episode({ watchedAt: CUTOFF, runtimeMinutes: 10 }),
          "1_2": episode({
            episodeNumber: 2,
            watchedAt: CUTOFF - 1,
            runtimeMinutes: 10,
          }),
        }),
      ],
    ])
    const lists = [
      listDoc(ALREADY_WATCHED_LIST_ID, {
        "movie-1": listItem({ addedAt: CUTOFF, runtimeMinutes: 100 }),
        "movie-2": listItem({ id: 201, addedAt: CUTOFF - 1, runtimeMinutes: 100 }),
      }),
    ]

    // 10 (episode at cutoff) + 100 (list item at cutoff)
    expect(computeProfileWatchTime(tracking, lists, NOW)).toBe(110)
  })

  it("counts a rewatched episode once (key overwrite, not duplicate)", () => {
    const tracking = new Map([
      ["100", trackingDoc({ "1_1": episode({ runtimeMinutes: 42 }) })],
    ])

    expect(computeProfileWatchTime(tracking, [], NOW)).toBe(42)
  })

  it("falls back to 45 minutes for unstamped episodes", () => {
    const tracking = new Map([
      [
        "100",
        trackingDoc({
          "1_1": episode({}),
          "1_2": episode({ episodeNumber: 2 }),
        }),
      ],
    ])

    expect(computeProfileWatchTime(tracking, [], NOW)).toBe(
      2 * EPISODE_RUNTIME_FALLBACK_MINUTES,
    )
  })

  it("falls back to 0 for unstamped movies and 45 for unstamped TV list items", () => {
    const lists = [
      listDoc(ALREADY_WATCHED_LIST_ID, {
        "movie-1": listItem({ media_type: "movie" }),
        "tv-1": listItem({ id: 300, media_type: "tv", title: "Show" }),
      }),
    ]

    expect(computeProfileWatchTime(new Map(), lists, NOW)).toBe(
      EPISODE_RUNTIME_FALLBACK_MINUTES,
    )
  })

  it("ignores lists other than already-watched", () => {
    const lists = [
      listDoc("watchlist", {
        "movie-1": listItem({ runtimeMinutes: 120 }),
      }),
      listDoc("favorites", {
        "movie-2": listItem({ id: 201, runtimeMinutes: 120 }),
      }),
      listDoc("custom-list", {
        "movie-3": listItem({ id: 202, runtimeMinutes: 120 }),
      }),
    ]

    expect(computeProfileWatchTime(new Map(), lists, NOW)).toBe(0)
  })

  it("ignores invalid runtime values (zero, negative, NaN, Infinity, strings)", () => {
    const tracking = new Map([
      [
        "100",
        trackingDoc({
          "1_1": episode({ runtimeMinutes: 0 }),
          "1_2": episode({ episodeNumber: 2, runtimeMinutes: -5 }),
          "1_3": episode({ episodeNumber: 3, runtimeMinutes: Number.NaN }),
          "1_4": episode({
            episodeNumber: 4,
            runtimeMinutes: Number.POSITIVE_INFINITY,
          }),
          "1_5": episode({ episodeNumber: 5, runtimeMinutes: "42" }),
        }),
      ],
    ])

    expect(computeProfileWatchTime(tracking, [], NOW)).toBe(
      5 * EPISODE_RUNTIME_FALLBACK_MINUTES,
    )
  })

  it("ignores avgRuntime metadata (mobile parity)", () => {
    const tracking = new Map([
      [
        "100",
        trackingDoc({
          "1_1": episode({}),
        }),
      ],
    ])
    tracking.get("100")!.metadata.avgRuntime = 22

    expect(computeProfileWatchTime(tracking, [], NOW)).toBe(
      EPISODE_RUNTIME_FALLBACK_MINUTES,
    )
  })

  it("returns 0 for empty data and skips falsy timestamps", () => {
    expect(computeProfileWatchTime(new Map(), [], NOW)).toBe(0)

    const tracking = new Map([
      ["100", trackingDoc({ "1_1": episode({ watchedAt: 0 }) })],
    ])
    const lists = [
      listDoc(ALREADY_WATCHED_LIST_ID, {
        "movie-1": listItem({ addedAt: 0, runtimeMinutes: 100 }),
      }),
    ]

    expect(computeProfileWatchTime(tracking, lists, NOW)).toBe(0)
  })
})

describe("getMonthsAgoTimestamp", () => {
  it("snaps to the 1st of the month at local midnight (mobile parity)", () => {
    const cutoff = getMonthsAgoTimestamp(6, NOW)
    const date = new Date(cutoff)

    expect(date.getDate()).toBe(1)
    expect(date.getHours()).toBe(0)
    expect(date.getMinutes()).toBe(0)
    expect(date.getSeconds()).toBe(0)
    // September 2026 minus 6 months = March 2026
    expect(date.getMonth()).toBe(2)
    expect(date.getFullYear()).toBe(2026)
  })
})

describe("formatWatchHours", () => {
  it("formats 57727 minutes like mobile", () => {
    expect(formatWatchHours(57727)).toBe("962hrs 7mins")
  })

  it("uses singular units for 1hr 1min", () => {
    expect(formatWatchHours(61)).toBe("1hr 1min")
  })

  it("treats zero, negative, and non-finite inputs as 0", () => {
    expect(formatWatchHours(0)).toBe("0hrs 0mins")
    expect(formatWatchHours(-10)).toBe("0hrs 0mins")
    expect(formatWatchHours(Number.NaN)).toBe("0hrs 0mins")
    expect(formatWatchHours(Number.POSITIVE_INFINITY)).toBe("0hrs 0mins")
  })
})
