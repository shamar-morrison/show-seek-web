import {
  addWatchedMovieToTrackedCollection,
  fetchCollectionTracking,
  getTrackedCollectionCount,
  getPreviouslyWatchedMovieIds,
  startCollectionTracking,
  stopCollectionTracking,
} from "@/lib/firebase/collection-tracking"
import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
} from "firebase/firestore"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/firebase/config", () => ({
  db: {},
}))

vi.mock("firebase/firestore", () => ({
  arrayRemove: vi.fn((value: number) => ({ op: "arrayRemove", value })),
  arrayUnion: vi.fn((value: number) => ({ op: "arrayUnion", value })),
  collection: vi.fn((_db, ...segments: string[]) => ({
    path: segments.join("/"),
  })),
  deleteDoc: vi.fn(async () => {}),
  doc: vi.fn((_db, ...segments: string[]) => ({
    path: segments.join("/"),
  })),
  getCountFromServer: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  limit: vi.fn((value: number) => value),
  query: vi.fn((ref: unknown) => ref),
  setDoc: vi.fn(async () => {}),
  updateDoc: vi.fn(async () => {}),
}))

describe("collection tracking firestore helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("loads a tracked collection when the document exists", async () => {
    vi.mocked(getDoc).mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        collectionId: 55,
        name: "Mission: Impossible Collection",
        totalMovies: 8,
        watchedMovieIds: [1, 2],
        startedAt: 100,
        lastUpdated: 200,
      }),
    } as Awaited<ReturnType<typeof getDoc>>)

    await expect(fetchCollectionTracking("user-1", 55)).resolves.toEqual({
      collectionId: 55,
      name: "Mission: Impossible Collection",
      totalMovies: 8,
      watchedMovieIds: [1, 2],
      startedAt: 100,
      lastUpdated: 200,
    })

    expect(doc).toHaveBeenCalledWith(
      {},
      "users",
      "user-1",
      "collection_tracking",
      "55",
    )
  })

  it("writes the expected tracking payload when tracking starts", async () => {
    vi.useFakeTimers()

    try {
      vi.setSystemTime(new Date("2026-03-10T18:45:00.000Z"))

      await startCollectionTracking(
        "user-1",
        77,
        "The Matrix Collection",
        4,
        [603],
      )

      expect(setDoc).toHaveBeenCalledWith(
        { path: "users/user-1/collection_tracking/77" },
        {
          collectionId: 77,
          name: "The Matrix Collection",
          totalMovies: 4,
          watchedMovieIds: [603],
          startedAt: 1773168300000,
          lastUpdated: 1773168300000,
        },
      )
    } finally {
      vi.useRealTimers()
    }
  })

  it("returns watched ids before deleting a tracked collection", async () => {
    vi.mocked(getDoc).mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        collectionId: 9,
        name: "Toy Story Collection",
        totalMovies: 4,
        watchedMovieIds: [101, 102],
        startedAt: 10,
        lastUpdated: 20,
      }),
    } as Awaited<ReturnType<typeof getDoc>>)

    await expect(stopCollectionTracking("user-1", 9)).resolves.toEqual([
      101, 102,
    ])

    expect(deleteDoc).toHaveBeenCalledWith({
      path: "users/user-1/collection_tracking/9",
    })
  })

  it("treats not-found collection updates as a no-op", async () => {
    vi.mocked(updateDoc).mockRejectedValueOnce({
      code: "firestore/not-found",
    })

    await expect(
      addWatchedMovieToTrackedCollection("user-1", 11, 999),
    ).resolves.toBeUndefined()

    expect(updateDoc).toHaveBeenCalledWith(
      { path: "users/user-1/collection_tracking/11" },
      {
        watchedMovieIds: arrayUnion(999),
        lastUpdated: expect.any(Number),
      },
    )
  })

  it("counts tracked collections with a Firestore aggregation", async () => {
    vi.mocked(getCountFromServer).mockResolvedValueOnce({
      data: () => ({ count: 7 }),
    } as Awaited<ReturnType<typeof getCountFromServer>>)

    await expect(getTrackedCollectionCount("user-1")).resolves.toBe(7)

    expect(getCountFromServer).toHaveBeenCalledWith({
      path: "users/user-1/collection_tracking",
    })
    expect(getDocs).not.toHaveBeenCalled()
  })

  it("deduplicates movie ids across more than one watched-history batch", async () => {
    vi.mocked(getDocs).mockImplementation(async (ref) => {
      const path = (ref as { path?: string }).path ?? ""
      const movieId = Number(path.split("/")[3])

      return {
        empty: movieId % 2 !== 0,
        docs: [],
      } as unknown as Awaited<ReturnType<typeof getDocs>>
    })

    await expect(
      getPreviouslyWatchedMovieIds(
        "user-1",
        [1, 2, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      ),
    ).resolves.toEqual([2, 4, 6, 8, 10])

    expect(collection).toHaveBeenCalledTimes(10)
    expect(getDocs).toHaveBeenCalledTimes(10)
  })
})
