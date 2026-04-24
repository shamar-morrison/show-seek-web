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
})
