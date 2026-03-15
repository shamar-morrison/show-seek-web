import { deleteWatch } from "@/lib/firebase/watched-movies"
import { deleteDoc, doc } from "firebase/firestore"
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
    fromDate: vi.fn(),
  },
  writeBatch: vi.fn(),
}))

describe("deleteWatch", () => {
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
})
