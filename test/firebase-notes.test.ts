import { fetchNotes, setNote } from "@/lib/firebase/notes"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  db: {},
  docRef: { path: "", id: "" },
  existingCreatedAt: { label: "existing-created-at" },
  now: { label: "now" },
  setDoc: vi.fn(async () => {}),
}))

vi.mock("@/lib/firebase/config", () => ({
  getFirebaseDb: vi.fn(() => mocks.db),
}))

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  deleteDoc: vi.fn(async () => {}),
  doc: vi.fn((_db, ...segments: string[]) => {
    const id = segments[segments.length - 1] ?? ""
    const ref = { path: segments.join("/"), id }
    mocks.docRef = ref
    return ref
  }),
  getDoc: vi.fn(async () => ({
    exists: () => true,
    data: () => ({
      createdAt: mocks.existingCreatedAt,
    }),
  })),
  getDocs: vi.fn(async () => ({
    docs: [
      {
        id: "episode-100-1-2",
        data: () => ({
          userId: "user-1",
          mediaId: 100,
          mediaType: "episode",
          content: "Episode note",
          mediaTitle: "Half Loop",
          originalTitle: "Half Loop Original",
          posterPath: "/poster.jpg",
          seasonNumber: 1,
          episodeNumber: 2,
          showId: 100,
          createdAt: { toMillis: () => 1 },
          updatedAt: { toMillis: () => 2 },
        }),
      },
    ],
  })),
  setDoc: mocks.setDoc,
  Timestamp: {
    now: vi.fn(() => mocks.now),
  },
}))

describe("firebase notes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("writes episode notes to the episode-specific document id with optional fields", async () => {
    await setNote("user-1", {
      id: "episode-100-1-2",
      userId: "user-1",
      mediaType: "episode",
      mediaId: 100,
      content: "Episode note",
      mediaTitle: "Half Loop",
      originalTitle: "Half Loop Original",
      posterPath: "/poster.jpg",
      seasonNumber: 1,
      episodeNumber: 2,
      showId: 100,
    })

    expect(mocks.docRef.path).toBe("users/user-1/notes/episode-100-1-2")
    expect(mocks.setDoc).toHaveBeenCalledWith(
      mocks.docRef,
      expect.objectContaining({
        userId: "user-1",
        mediaType: "episode",
        mediaId: 100,
        content: "Episode note",
        mediaTitle: "Half Loop",
        originalTitle: "Half Loop Original",
        posterPath: "/poster.jpg",
        seasonNumber: 1,
        episodeNumber: 2,
        showId: 100,
        createdAt: mocks.existingCreatedAt,
        updatedAt: mocks.now,
      }),
    )
  })

  it("hydrates note ids from Firestore document ids", async () => {
    const notes = await fetchNotes("user-1")

    expect(notes.get("episode-100-1-2")).toEqual({
      id: "episode-100-1-2",
      userId: "user-1",
      mediaId: 100,
      mediaType: "episode",
      content: "Episode note",
      mediaTitle: "Half Loop",
      originalTitle: "Half Loop Original",
      posterPath: "/poster.jpg",
      seasonNumber: 1,
      episodeNumber: 2,
      showId: 100,
      createdAt: { toMillis: expect.any(Function) },
      updatedAt: { toMillis: expect.any(Function) },
    })
  })
})
