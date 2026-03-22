import { deleteWatch, updateWatch } from "@/lib/firebase/watched-movies"
import { deleteDoc, doc, Timestamp, updateDoc } from "firebase/firestore"
import { describe, expect, it, vi } from "vitest"

const dbMock = {}

vi.mock("@/lib/firebase/config", () => ({
  getFirebaseDb: vi.fn(() => dbMock),
}))

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  deleteDoc: vi.fn(async () => {}),
  doc: vi.fn((_db, ...segments: string[]) => ({
    path: segments.join("/"),
  })),
  getCountFromServer: vi.fn(),
  getDocs: vi.fn(),
  setDoc: vi.fn(),
  Timestamp: {
    fromDate: vi.fn((date: Date) => ({ date })),
  },
  updateDoc: vi.fn(async () => {}),
  writeBatch: vi.fn(),
}))

describe("watched movie firebase helpers", () => {
  it("deletes a single watch instance by watch id", async () => {
    await deleteWatch("user-1", 900, "watch-123")

    expect(doc).toHaveBeenCalledWith(
      dbMock,
      "users",
      "user-1",
      "watched_movies",
      "900",
      "watches",
      "watch-123",
    )
    expect(deleteDoc).toHaveBeenCalledWith({
      path: "users/user-1/watched_movies/900/watches/watch-123",
    })
  })

  it("updates a single watch instance date by watch id", async () => {
    const watchedAt = new Date("2026-03-10T20:00:00.000Z")

    await updateWatch("user-1", 900, "watch-123", watchedAt)

    expect(doc).toHaveBeenCalledWith(
      dbMock,
      "users",
      "user-1",
      "watched_movies",
      "900",
      "watches",
      "watch-123",
    )
    expect(Timestamp.fromDate).toHaveBeenCalledWith(watchedAt)
    expect(updateDoc).toHaveBeenCalledWith(
      {
        path: "users/user-1/watched_movies/900/watches/watch-123",
      },
      {
        watchedAt: { date: watchedAt },
      },
    )
  })
})
