import {
  addFavoriteEpisode,
  fetchFavoriteEpisodes,
  removeFavoriteEpisode,
} from "@/lib/firebase/favorite-episodes"
import type { FavoriteEpisode } from "@/types/favorite-episode"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  db: {},
  deleteDoc: vi.fn(async () => {}),
  docRef: { path: "", id: "" },
  getDocs: vi.fn(async () => ({
    docs: [
      {
        data: () => ({
          id: "100-1-2",
          tvShowId: 100,
          seasonNumber: 1,
          episodeNumber: 2,
          episodeName: "Half Loop",
          showName: "Signal Run",
          posterPath: "/poster.jpg",
          addedAt: 123,
        }),
      },
    ],
  })),
  setDoc: vi.fn(async () => {}),
}))

vi.mock("@/lib/firebase/config", () => ({
  getFirebaseDb: vi.fn(() => mocks.db),
}))

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  deleteDoc: mocks.deleteDoc,
  doc: vi.fn((_db, ...segments: string[]) => {
    const id = segments[segments.length - 1] ?? ""
    const ref = { path: segments.join("/"), id }
    mocks.docRef = ref
    return ref
  }),
  getDocs: mocks.getDocs,
  orderBy: vi.fn((field: string, direction: string) => ({ field, direction })),
  query: vi.fn((_collectionRef, order) => order),
  setDoc: mocks.setDoc,
}))

describe("firebase favorite episodes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetches favorite episodes newest-first from the favorite_episodes collection", async () => {
    const episodes = await fetchFavoriteEpisodes("user-1")

    expect(episodes).toEqual<FavoriteEpisode[]>([
      {
        id: "100-1-2",
        tvShowId: 100,
        seasonNumber: 1,
        episodeNumber: 2,
        episodeName: "Half Loop",
        showName: "Signal Run",
        posterPath: "/poster.jpg",
        addedAt: 123,
      },
    ])
  })

  it("writes favorite episodes to the mobile-compatible document path and shape", async () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(456)

    await addFavoriteEpisode("user-1", {
      id: "100-1-2",
      tvShowId: 100,
      seasonNumber: 1,
      episodeNumber: 2,
      episodeName: "Half Loop",
      showName: "Signal Run",
      posterPath: "/poster.jpg",
    })

    expect(mocks.docRef.path).toBe("users/user-1/favorite_episodes/100-1-2")
    expect(mocks.setDoc).toHaveBeenCalledWith(mocks.docRef, {
      id: "100-1-2",
      tvShowId: 100,
      seasonNumber: 1,
      episodeNumber: 2,
      episodeName: "Half Loop",
      showName: "Signal Run",
      posterPath: "/poster.jpg",
      addedAt: 456,
    })

    nowSpy.mockRestore()
  })

  it("removes favorite episodes from the favorite_episodes collection", async () => {
    await removeFavoriteEpisode("user-1", "100-1-2")

    expect(mocks.docRef.path).toBe("users/user-1/favorite_episodes/100-1-2")
    expect(mocks.deleteDoc).toHaveBeenCalledWith(mocks.docRef)
  })
})
