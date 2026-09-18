import { episodeTrackingService } from "@/services/episode-tracking-service"
import { getDoc, setDoc, updateDoc } from "firebase/firestore"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/firebase/config", () => ({
  getFirebaseAuth: vi.fn(() => ({
    currentUser: { uid: "user-1" },
  })),
  getFirebaseDb: vi.fn(() => ({})),
}))

vi.mock("firebase/firestore", () => ({
  deleteDoc: vi.fn(),
  deleteField: vi.fn(),
  doc: vi.fn(() => ({ path: "users/user-1/episode_tracking/777" })),
  getDoc: vi.fn(),
  setDoc: vi.fn(async () => {}),
  updateDoc: vi.fn(),
}))

function makeEpisodes(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    seasonNumber: 1,
    episode: {
      id: 1000 + index,
      episode_number: index + 1,
      name: `Episode ${index + 1}`,
      air_date: "2024-01-01",
    },
  }))
}

describe("markEntireShowWatched", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(setDoc).mockResolvedValue(undefined as never)
  })

  it("writes episodes in chunks with progress", async () => {
    const onProgress: Array<[number, number]> = []

    const result = await episodeTrackingService.markEntireShowWatched(
      777,
      makeEpisodes(25),
      { tvShowName: "Signal Run", posterPath: "/show.jpg" },
      {
        batchSize: 10,
        delayMs: 0,
        onProgress: (marked, total) => {
          onProgress.push([marked, total])
        },
      },
    )

    expect(result).toEqual({ markedCount: 25, wasCancelled: false })
    expect(vi.mocked(setDoc)).toHaveBeenCalledTimes(3)
    expect(onProgress).toEqual([
      [10, 25],
      [20, 25],
      [25, 25],
    ])

    // First chunk payload shape
    const firstCall = vi.mocked(setDoc).mock.calls[0]
    expect(firstCall[2]).toEqual({ merge: true })
    const firstBody = firstCall[1] as {
      episodes: Record<string, { episodeNumber: number }>
      metadata: { tvShowName: string }
    }
    expect(Object.keys(firstBody.episodes)).toHaveLength(10)
    expect(firstBody.episodes["1_1"].episodeNumber).toBe(1)
    expect(firstBody.metadata.tvShowName).toBe("Signal Run")
  })

  it("stops early when cancelled", async () => {
    let calls = 0
    vi.mocked(setDoc).mockImplementation(async () => {
      calls += 1
    })

    const result = await episodeTrackingService.markEntireShowWatched(
      777,
      makeEpisodes(25),
      { tvShowName: "Signal Run", posterPath: null },
      {
        batchSize: 10,
        delayMs: 0,
        isCancelled: () => calls >= 1,
      },
    )

    expect(result.wasCancelled).toBe(true)
    expect(result.markedCount).toBe(10)
    expect(vi.mocked(setDoc)).toHaveBeenCalledTimes(1)
  })

  it("persists showStats and null nextEpisode in metadata", async () => {
    await episodeTrackingService.markEntireShowWatched(
      777,
      makeEpisodes(2),
      { tvShowName: "Signal Run", posterPath: "/show.jpg" },
      { batchSize: 10, delayMs: 0 },
      { totalEpisodes: 3, avgRuntime: 42 },
      null,
    )

    expect(vi.mocked(setDoc)).toHaveBeenCalledTimes(1)
    const body = vi.mocked(setDoc).mock.calls[0][1] as {
      metadata: {
        tvShowName: string
        posterPath: string | null
        totalEpisodes: number
        avgRuntime: number
        nextEpisode: null
      }
    }
    expect(body.metadata).toMatchObject({
      tvShowName: "Signal Run",
      posterPath: "/show.jpg",
      totalEpisodes: 3,
      avgRuntime: 42,
      nextEpisode: null,
    })
  })

  it("writes nextEpisode only on the final chunk of a completed run", async () => {
    await episodeTrackingService.markEntireShowWatched(
      777,
      makeEpisodes(25),
      { tvShowName: "Signal Run", posterPath: null },
      { batchSize: 10, delayMs: 0 },
      undefined,
      null,
    )

    const calls = vi.mocked(setDoc).mock.calls
    expect(calls).toHaveLength(3)
    const bodies = calls.map(
      (call) => call[1] as { metadata: Record<string, unknown> },
    )
    expect(bodies[0].metadata).not.toHaveProperty("nextEpisode")
    expect(bodies[1].metadata).not.toHaveProperty("nextEpisode")
    expect(bodies[2].metadata).toHaveProperty("nextEpisode", null)
  })

  it("does not write nextEpisode on a cancelled partial run", async () => {
    let calls = 0
    vi.mocked(setDoc).mockImplementation(async () => {
      calls += 1
    })

    const result = await episodeTrackingService.markEntireShowWatched(
      777,
      makeEpisodes(25),
      { tvShowName: "Signal Run", posterPath: null },
      {
        batchSize: 10,
        delayMs: 0,
        isCancelled: () => calls >= 1,
      },
      { totalEpisodes: 25, avgRuntime: 42 },
      null,
    )

    expect(result.wasCancelled).toBe(true)
    expect(vi.mocked(setDoc)).toHaveBeenCalledTimes(1)
    const body = vi.mocked(setDoc).mock.calls[0][1] as {
      metadata: Record<string, unknown>
    }
    expect(body.metadata).not.toHaveProperty("nextEpisode")
  })

  it("returns zero without writing when there is nothing to mark", async () => {
    const result = await episodeTrackingService.markEntireShowWatched(
      777,
      [],
      { tvShowName: "Signal Run", posterPath: null },
    )

    expect(result).toEqual({ markedCount: 0, wasCancelled: false })
    expect(vi.mocked(setDoc)).not.toHaveBeenCalled()
  })
})

function makeUnmarkEpisodes(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    seasonNumber: 1,
    episodeNumber: index + 1,
  }))
}

describe("markEntireShowUnwatched", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getDoc).mockResolvedValue({ exists: () => true } as never)
    vi.mocked(updateDoc).mockResolvedValue(undefined as never)
  })

  it("deletes episode fields in chunks with progress and preserves metadata", async () => {
    const onProgress: Array<[number, number]> = []

    const result = await episodeTrackingService.markEntireShowUnwatched(
      777,
      makeUnmarkEpisodes(25),
      {
        batchSize: 10,
        delayMs: 0,
        onProgress: (unmarked, total) => {
          onProgress.push([unmarked, total])
        },
      },
    )

    expect(result).toEqual({ unmarkedCount: 25, wasCancelled: false })
    expect(vi.mocked(getDoc)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(updateDoc)).toHaveBeenCalledTimes(3)
    expect(onProgress).toEqual([
      [10, 25],
      [20, 25],
      [25, 25],
    ])

    // First chunk payload: deleteField per episode + only metadata.lastUpdated.
    const firstPayload = vi.mocked(updateDoc).mock.calls[0][1] as unknown as
      Record<string, unknown>
    expect(Object.keys(firstPayload)).toContain("episodes.1_1")
    expect(Object.keys(firstPayload)).toContain("episodes.1_10")
    expect(typeof firstPayload["metadata.lastUpdated"]).toBe("number")
    expect(firstPayload).not.toHaveProperty("metadata.tvShowName")
  })

  it("returns zero without reading or writing when there is nothing to unmark", async () => {
    const result = await episodeTrackingService.markEntireShowUnwatched(777, [])

    expect(result).toEqual({ unmarkedCount: 0, wasCancelled: false })
    expect(vi.mocked(getDoc)).not.toHaveBeenCalled()
    expect(vi.mocked(updateDoc)).not.toHaveBeenCalled()
  })

  it("skips writing when the tracking document does not exist", async () => {
    vi.mocked(getDoc).mockResolvedValue({ exists: () => false } as never)

    const result = await episodeTrackingService.markEntireShowUnwatched(
      777,
      makeUnmarkEpisodes(5),
      { batchSize: 10, delayMs: 0 },
    )

    expect(result).toEqual({ unmarkedCount: 0, wasCancelled: false })
    expect(vi.mocked(updateDoc)).not.toHaveBeenCalled()
  })

  it("stops early when cancelled", async () => {
    let calls = 0
    vi.mocked(updateDoc).mockImplementation(async () => {
      calls += 1
    })

    const result = await episodeTrackingService.markEntireShowUnwatched(
      777,
      makeUnmarkEpisodes(25),
      {
        batchSize: 10,
        delayMs: 0,
        isCancelled: () => calls >= 1,
      },
    )

    expect(result.wasCancelled).toBe(true)
    expect(result.unmarkedCount).toBe(10)
    expect(vi.mocked(updateDoc)).toHaveBeenCalledTimes(1)
  })
})
