import { setRating } from "@/lib/firebase/ratings"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  db: {},
  transactionSet: vi.fn(),
  serverTimestamp: { __type: "server-timestamp" },
}))

vi.mock("@/lib/firebase/config", () => ({
  getFirebaseDb: vi.fn(() => mocks.db),
}))

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  deleteDoc: vi.fn(async () => {}),
  doc: vi.fn((_db, ...segments: string[]) => ({
    path: segments.join("/"),
  })),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  runTransaction: vi.fn(async (_db, callback: (transaction: unknown) => unknown) =>
    callback({
      set: (...args: unknown[]) => mocks.transactionSet(...args),
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
})
