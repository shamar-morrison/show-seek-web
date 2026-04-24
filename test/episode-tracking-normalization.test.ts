import { normalizeEpisodeTrackingDoc } from "@/lib/episode-tracking-normalization"
import { describe, expect, it } from "vitest"

function timestampLike(millis: number) {
  return {
    toMillis: () => millis,
  }
}

describe("normalizeEpisodeTrackingDoc", () => {
  it("normalizes mobile-backed Trakt timestamp shapes", () => {
    const normalized = normalizeEpisodeTrackingDoc({
      episodes: {
        "1_1": {
          episodeId: 101,
          episodeName: "Pilot",
          tvShowId: 100,
          watchedAt: timestampLike(1710000000000),
        },
        "1_2": {
          episodeAirDate: "2024-02-01",
          episodeId: 102,
          episodeName: "Second",
          episodeNumber: 2,
          seasonNumber: 1,
          tvShowId: 100,
          watchedAt: "2024-02-03T12:00:00.000Z",
        },
      },
      metadata: {
        lastUpdated: timestampLike(1710000005000),
        posterPath: "/poster.jpg",
        tvShowName: "Example Show",
      },
    })

    expect(normalized.episodes["1_1"]).toMatchObject({
      episodeId: 101,
      episodeName: "Pilot",
      episodeNumber: 1,
      seasonNumber: 1,
      tvShowId: 100,
      watchedAt: 1710000000000,
    })
    expect(normalized.episodes["1_2"]).toMatchObject({
      watchedAt: Date.parse("2024-02-03T12:00:00.000Z"),
    })
    expect(normalized.metadata).toMatchObject({
      lastUpdated: 1710000005000,
      posterPath: "/poster.jpg",
      tvShowName: "Example Show",
    })
  })

  it("falls back to latest episode watch time when metadata is missing", () => {
    const normalized = normalizeEpisodeTrackingDoc({
      episodes: {
        "2_3": {
          watchedAt: timestampLike(1710000009000),
        },
      },
    })

    expect(normalized.metadata.lastUpdated).toBe(1710000009000)
    expect(normalized.metadata.posterPath).toBeNull()
    expect(normalized.metadata.tvShowName).toBe("")
  })

  it("falls back to episode keys when season or episode numbers are missing or NaN", () => {
    const normalized = normalizeEpisodeTrackingDoc({
      episodes: {
        "3_4": {
          episodeNumber: Number.NaN,
          seasonNumber: Number.NaN,
          watchedAt: 1710000000000,
        },
        "5_6": {
          watchedAt: 1710000005000,
        },
      },
    })

    expect(normalized.episodes["3_4"]).toMatchObject({
      episodeNumber: 4,
      seasonNumber: 3,
    })
    expect(normalized.episodes["5_6"]).toMatchObject({
      episodeNumber: 6,
      seasonNumber: 5,
    })
  })

  it("filters non-object episodes and coerces invalid watchedAt values to zero", () => {
    const normalized = normalizeEpisodeTrackingDoc({
      episodes: {
        "1_1": null,
        "1_2": "bad",
        "1_3": {
          watchedAt: "not-a-date",
        },
        "1_4": {},
      },
    })

    expect(Object.keys(normalized.episodes)).toEqual(["1_3", "1_4"])
    expect(normalized.episodes["1_3"].watchedAt).toBe(0)
    expect(normalized.episodes["1_4"].watchedAt).toBe(0)
  })

  it("computes missing lastUpdated from the max normalized watchedAt", () => {
    const normalized = normalizeEpisodeTrackingDoc({
      episodes: {
        "1_1": {
          watchedAt: 1710000000000,
        },
        "1_2": {
          watchedAt: timestampLike(1710000009000),
        },
        "1_3": {
          watchedAt: "not-a-date",
        },
      },
      metadata: {
        lastUpdated: undefined,
      },
    })

    expect(normalized.metadata.lastUpdated).toBe(1710000009000)
    expect(normalized.episodes["1_1"].watchedAt).toBe(1710000000000)
  })

  it("preserves a legitimate epoch lastUpdated and drops unknown fields", () => {
    const normalized = normalizeEpisodeTrackingDoc({
      episodes: {
        "1_1": {
          extra: "ignored",
          watchedAt: 1710000000000,
        },
      },
      metadata: {
        extra: "ignored",
        lastUpdated: 0,
        nextEpisode: {
          airDate: "2026-04-23",
          episode: 2,
          season: 1,
          title: "Next",
        },
        totalEpisodes: 8,
      },
    })

    expect(normalized.metadata).toEqual({
      lastUpdated: 0,
      nextEpisode: {
        airDate: "2026-04-23",
        episode: 2,
        season: 1,
        title: "Next",
      },
      posterPath: null,
      totalEpisodes: 8,
      tvShowName: "",
    })
    expect(normalized.episodes["1_1"]).not.toHaveProperty("extra")
  })
})
