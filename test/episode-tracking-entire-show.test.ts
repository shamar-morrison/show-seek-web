import { episodeTrackingService } from "@/services/episode-tracking-service"
import { setDoc } from "firebase/firestore"
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
