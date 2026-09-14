import { episodeTrackingService } from "@/services/episode-tracking-service"
import { getDoc, setDoc } from "firebase/firestore"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuth = vi.hoisted(() => ({
  currentUser: { uid: "user-1" } as { uid: string } | null,
}))

vi.mock("@/lib/firebase/config", () => ({
  getFirebaseAuth: vi.fn(() => mockAuth),
  getFirebaseDb: vi.fn(() => ({})),
}))

vi.mock("firebase/firestore", () => ({
  deleteDoc: vi.fn(),
  deleteField: vi.fn(),
  doc: vi.fn((_db, ...pathSegments) => ({
    path: pathSegments.join("/"),
  })),
  getDoc: vi.fn(),
  setDoc: vi.fn(async () => {}),
  updateDoc: vi.fn(async () => {}),
}))

describe("episodeTrackingService.markEpisodeWatched with markPreviousEpisodesWatched", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.currentUser = { uid: "user-1" }
  })

  it("recomputes nextEpisode when earlier episodes are marked watched so it never references a newly watched episode", async () => {
    // Existing tracking document has no watched episodes
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => false,
      data: () => ({}),
    } as never)

    const seasonEpisodes = [
      { id: 101, episode_number: 1, name: "Episode 1", air_date: "2020-01-01" },
      { id: 102, episode_number: 2, name: "Episode 2", air_date: "2020-01-08" },
      { id: 103, episode_number: 3, name: "Episode 3", air_date: "2020-01-15" },
    ]

    // Marking Episode 2 watched with markPreviousEpisodesWatched = true,
    // but the UI passed nextEpisode pointing to Episode 1 (stale, pre-auto-mark)
    await episodeTrackingService.markEpisodeWatched(
      100,
      1,
      2,
      { episodeId: 102, episodeName: "Episode 2", episodeAirDate: "2020-01-08" },
      { tvShowName: "Test Show", posterPath: null },
      { totalEpisodes: 3, avgRuntime: 45 },
      { season: 1, episode: 1, title: "Episode 1", airDate: "2020-01-01" },
      true,
      seasonEpisodes,
    )

    expect(setDoc).toHaveBeenCalledTimes(1)
    const payload = vi.mocked(setDoc).mock.calls[0][1] as unknown as {
      episodes: Record<string, unknown>
      metadata: { nextEpisode: unknown }
    }

    // Both episode 1 and episode 2 are marked watched
    expect(payload.episodes).toHaveProperty("1_1")
    expect(payload.episodes).toHaveProperty("1_2")

    // nextEpisode is recomputed to Episode 3, NOT Episode 1
    expect(payload.metadata.nextEpisode).toEqual({
      season: 1,
      episode: 3,
      title: "Episode 3",
      airDate: "2020-01-15",
    })
  })

  it("preserves nextEpisode when no earlier episodes are added", async () => {
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => ({
        episodes: {
          "1_1": {
            episodeId: 101,
            seasonNumber: 1,
            episodeNumber: 1,
            episodeName: "Episode 1",
            episodeAirDate: "2020-01-01",
            watchedAt: 1000,
          },
        },
      }),
    } as never)

    const seasonEpisodes = [
      { id: 101, episode_number: 1, name: "Episode 1", air_date: "2020-01-01" },
      { id: 102, episode_number: 2, name: "Episode 2", air_date: "2020-01-08" },
      { id: 103, episode_number: 3, name: "Episode 3", air_date: "2020-01-15" },
    ]

    // Episode 1 was already watched, marking Episode 2 watched
    await episodeTrackingService.markEpisodeWatched(
      100,
      1,
      2,
      { episodeId: 102, episodeName: "Episode 2", episodeAirDate: "2020-01-08" },
      { tvShowName: "Test Show", posterPath: null },
      { totalEpisodes: 3, avgRuntime: 45 },
      { season: 1, episode: 3, title: "Episode 3", airDate: "2020-01-15" },
      true,
      seasonEpisodes,
    )

    expect(setDoc).toHaveBeenCalledTimes(1)
    const payload = vi.mocked(setDoc).mock.calls[0][1] as unknown as {
      episodes: Record<string, unknown>
      metadata: { nextEpisode: unknown }
    }

    expect(payload.metadata.nextEpisode).toEqual({
      season: 1,
      episode: 3,
      title: "Episode 3",
      airDate: "2020-01-15",
    })
  })
})
