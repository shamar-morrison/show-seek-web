import { fetchUserList, restoreList } from "@/lib/firebase/lists"
import { doc, getDoc, setDoc } from "firebase/firestore"
import { beforeEach, describe, expect, it, vi } from "vitest"

const dbMock = {}

vi.mock("@/lib/firebase/config", () => ({
  getFirebaseDb: vi.fn(() => dbMock),
}))

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  deleteDoc: vi.fn(),
  deleteField: vi.fn(),
  doc: vi.fn((_db, ...segments: string[]) => ({
    path: segments.join("/"),
  })),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  runTransaction: vi.fn(),
  serverTimestamp: vi.fn(() => "server-timestamp"),
  setDoc: vi.fn(async () => {}),
  updateDoc: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe("fetchUserList", () => {
  it("returns a single list when the document exists", async () => {
    vi.mocked(getDoc).mockResolvedValue({
      data: () => ({
        name: "Road Trip",
        items: {},
        createdAt: 1234,
        isCustom: true,
      }),
      exists: () => true,
      id: "road-trip",
    } as Awaited<ReturnType<typeof getDoc>>)

    await expect(fetchUserList("user-1", "road-trip")).resolves.toEqual({
      id: "road-trip",
      name: "Road Trip",
      items: {},
      createdAt: 1234,
      isCustom: true,
    })

    expect(doc).toHaveBeenCalledWith(
      dbMock,
      "users",
      "user-1",
      "lists",
      "road-trip",
    )
  })

  it("returns null when the list document does not exist", async () => {
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => false,
    } as Awaited<ReturnType<typeof getDoc>>)

    await expect(fetchUserList("user-1", "missing")).resolves.toBeNull()
  })
})

describe("restoreList", () => {
  it("restores a deleted custom list with its original id and items", async () => {
    await restoreList("user-1", {
      id: "road-trip",
      name: "Road Trip",
      items: {
        "123": {
          id: 123,
          title: "Mad Max",
          poster_path: null,
          media_type: "movie",
          addedAt: 111,
        },
      },
      createdAt: 1234,
      updatedAt: 5678,
    })

    expect(doc).toHaveBeenCalledWith(
      dbMock,
      "users",
      "user-1",
      "lists",
      "road-trip",
    )
    expect(setDoc).toHaveBeenCalledWith(
      { path: "users/user-1/lists/road-trip" },
      {
        id: "road-trip",
        name: "Road Trip",
        items: {
          "123": {
            id: 123,
            title: "Mad Max",
            poster_path: null,
            media_type: "movie",
            addedAt: 111,
          },
        },
        createdAt: 1234,
        updatedAt: 5678,
        isCustom: true,
      },
    )
  })

  it("rejects attempts to restore default lists", async () => {
    await expect(
      restoreList("user-1", {
        id: "watchlist",
        name: "Should Watch",
        items: {},
        createdAt: 0,
      }),
    ).rejects.toThrow("Cannot restore default lists")

    expect(setDoc).not.toHaveBeenCalled()
  })
})
