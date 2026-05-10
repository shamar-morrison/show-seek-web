import {
  deleteSeasonRating,
  fetchRatings,
  setRating,
} from "@/lib/firebase/ratings"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  db: {},
  deleteDoc: vi.fn(async () => {}),
  getDocs: vi.fn(),
  transactionSet: vi.fn(),
  serverTimestamp: { __type: "server-timestamp" },
}))

vi.mock("@/lib/firebase/config", () => ({
  getFirebaseDb: vi.fn(() => mocks.db),
}))

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  deleteDoc: mocks.deleteDoc,
  doc: vi.fn((_db, ...segments: string[]) => ({
    path: segments.join("/"),
  })),
  getDoc: vi.fn(),
  getDocs: mocks.getDocs,
  runTransaction: vi.fn(async (_db, callback: (transaction: unknown) => unknown) =>
    callback({
      set: mocks.transactionSet,
    }),
  ),
  serverTimestamp: vi.fn(() => mocks.serverTimestamp),
  Timestamp: class Timestamp {
    toMillis() {
      return 0
    }
  },
}))

describe("firebase ratings writes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getDocs.mockResolvedValue({ docs: [] })
  })

  it("omits originalTitle when the rating input does not provide one", async () => {
    await setRating("user-1", {
      userId: "user-1",
      id: "movie-123",
      mediaId: "123",
      mediaType: "movie",
      rating: 9,
      title: "Spirited Away",
      posterPath: null,
      releaseDate: "2001-07-20",
    })

    const payload = mocks.transactionSet.mock.calls[0]?.[1] as Record<
      string,
      unknown
    >

    expect(payload).not.toHaveProperty("originalTitle")
    expect(payload).toMatchObject({
      id: "123",
      mediaType: "movie",
      rating: 9,
      title: "Spirited Away",
      posterPath: null,
      releaseDate: "2001-07-20",
      ratedAt: mocks.serverTimestamp,
    })
  })

  it("includes originalTitle when the rating input provides one", async () => {
    await setRating("user-1", {
      userId: "user-1",
      id: "movie-123",
      mediaId: "123",
      mediaType: "movie",
      rating: 9,
      title: "Spirited Away",
      originalTitle: "Sen to Chihiro no Kamikakushi",
      posterPath: null,
      releaseDate: "2001-07-20",
    })

    const payload = mocks.transactionSet.mock.calls[0]?.[1] as Record<
      string,
      unknown
    >

    expect(payload).toHaveProperty(
      "originalTitle",
      "Sen to Chihiro no Kamikakushi",
    )
  })

  it("normalizes mobile-style season ratings when fetching ratings", async () => {
    mocks.getDocs.mockResolvedValue({
      docs: [
        {
          id: "season-777-2",
          data: () => ({
            id: "season-777-2",
            mediaType: "season",
            rating: 8.5,
            title: "Season 2",
            posterPath: "/season.jpg",
            releaseDate: "2025-01-01",
            ratedAt: 123,
            tvShowId: 777,
            seasonNumber: 2,
            tvShowName: "Signal Run",
          }),
        },
      ],
    })

    const ratings = await fetchRatings("user-1")

    expect(ratings.get("season-777-2")).toEqual({
      id: "season-777-2",
      mediaId: "777",
      mediaType: "season",
      rating: 8.5,
      title: "Season 2",
      originalTitle: undefined,
      posterPath: "/season.jpg",
      releaseDate: "2025-01-01",
      ratedAt: 123,
      tvShowId: 777,
      seasonNumber: 2,
      episodeNumber: undefined,
      episodeName: undefined,
      tvShowName: "Signal Run",
    })
  })

  it("skips malformed shared rating docs when fetching ratings", async () => {
    mocks.getDocs.mockResolvedValue({
      docs: [
        {
          id: "season-777-2",
          data: () => ({
            mediaType: "season",
            rating: 8.5,
            ratedAt: 123,
            tvShowId: 777,
            seasonNumber: 2,
            tvShowName: "Signal Run",
          }),
        },
        {
          id: "broken-1",
          data: () => ({
            mediaType: "unknown",
            rating: 10,
            ratedAt: 123,
          }),
        },
      ],
    })

    const ratings = await fetchRatings("user-1")

    expect(ratings.size).toBe(1)
    expect(ratings.has("season-777-2")).toBe(true)
    expect(ratings.has("broken-1")).toBe(false)
  })

  it("deletes season ratings using the shared season document id", async () => {
    await deleteSeasonRating("user-1", 777, 2)

    expect(mocks.deleteDoc).toHaveBeenCalledTimes(1)

    const [ratingRef] = mocks.deleteDoc.mock.calls[0] as unknown as [{ path: string }]
    expect(ratingRef.path).toBe("users/user-1/ratings/season-777-2")
  })
})
