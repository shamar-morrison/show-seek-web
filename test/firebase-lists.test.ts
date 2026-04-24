import {
  addToList,
  createList,
  fetchUserList,
  fetchUserLists,
  removeMediaFromList,
  restoreList,
  updateList,
} from "@/lib/firebase/lists"
import {
  deleteField,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  setDoc,
  updateDoc,
} from "firebase/firestore"
import { beforeEach, describe, expect, it, vi } from "vitest"

const dbMock = {}

vi.mock("@/lib/firebase/config", () => ({
  getFirebaseDb: vi.fn(() => dbMock),
}))

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  deleteDoc: vi.fn(),
  deleteField: vi.fn(() => "delete-field-token"),
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

function createRestoreListPayload(): Parameters<typeof restoreList>[1] {
  return {
    id: "road-trip",
    name: "Road Trip",
    description: "Weekend plans",
    items: {
      "123": {
        id: 123,
        title: "Mad Max",
        poster_path: null,
        media_type: "movie" as const,
        addedAt: 111,
      },
    },
    createdAt: 1234,
    updatedAt: 5678,
  }
}

async function runCreateListWithCurrentDoc(
  currentDoc: {
    exists: () => boolean
    data?: () => Record<string, unknown>
  },
  listName = "Road Trip",
  description = "  Weekend plans  ",
) {
  const transaction = {
    get: vi.fn().mockResolvedValue(currentDoc),
    set: vi.fn(),
  }

  vi.mocked(runTransaction).mockImplementation(async (_db, callback) => {
    return (await callback(transaction as never)) as never
  })

  const listId = await createList("user-1", listName, description)

  return { listId, transaction }
}

function createTimestampLike(millis: number) {
  return {
    toMillis: () => millis,
  }
}

async function runRestoreListWithCurrentDoc(
  currentDoc: {
    exists: () => boolean
    data?: () => Record<string, unknown>
  },
  list: Parameters<typeof restoreList>[1] = createRestoreListPayload(),
) {
  const transaction = {
    get: vi.fn().mockResolvedValue(currentDoc),
    set: vi.fn(),
  }

  vi.mocked(runTransaction).mockImplementation(async (_db, callback) => {
    return (await callback(transaction as never)) as never
  })

  const restored = await restoreList("user-1", list)

  return { restored, transaction }
}

async function runAddToListWithCurrentDoc(
  currentDoc: {
    exists: () => boolean
    data?: () => Record<string, unknown>
  },
  mediaItem: Parameters<typeof addToList>[2],
) {
  const transaction = {
    get: vi.fn().mockResolvedValue(currentDoc),
    set: vi.fn(),
  }

  vi.mocked(runTransaction).mockImplementation(async (_db, callback) => {
    return (await callback(transaction as never)) as never
  })

  const wasAdded = await addToList("user-1", "watchlist", mediaItem)

  return { wasAdded, transaction }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("fetchUserList", () => {
  it("returns a single list when the document exists", async () => {
    vi.mocked(getDoc).mockResolvedValue({
      data: () => ({
        name: "Road Trip",
        description: "Weekend plans",
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
      description: "Weekend plans",
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

  it("normalizes Trakt-imported item timestamps to milliseconds", async () => {
    vi.mocked(getDoc).mockResolvedValue({
      data: () => ({
        name: "Already Watched",
        items: {
          "movie-123": {
            id: 123,
            title: "Mad Max",
            poster_path: null,
            media_type: "movie",
            addedAt: createTimestampLike(1710000000000),
          },
        },
      }),
      exists: () => true,
      id: "already-watched",
    } as Awaited<ReturnType<typeof getDoc>>)

    await expect(
      fetchUserList("user-1", "already-watched"),
    ).resolves.toMatchObject({
      id: "already-watched",
      items: {
        "movie-123": {
          addedAt: 1710000000000,
          id: 123,
          media_type: "movie",
        },
      },
    })
  })

  it("returns null when the list document does not exist", async () => {
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => false,
    } as Awaited<ReturnType<typeof getDoc>>)

    await expect(fetchUserList("user-1", "missing")).resolves.toBeNull()
  })
})

describe("fetchUserLists", () => {
  it("preserves numeric and prefixed list item keys while normalizing addedAt", async () => {
    vi.mocked(getDocs).mockResolvedValue({
      docs: [
        {
          data: () => ({
            name: "Already Watched",
            items: {
              "123": {
                id: 123,
                title: "Legacy Movie",
                poster_path: null,
                media_type: "movie",
                addedAt: createTimestampLike(1710000000000),
              },
              "movie-456": {
                id: 456,
                title: "Prefixed Movie",
                poster_path: null,
                media_type: "movie",
                addedAt: 1710000005000,
              },
            },
          }),
          id: "already-watched",
        },
      ],
    } as Awaited<ReturnType<typeof getDocs>>)

    await expect(fetchUserLists("user-1")).resolves.toEqual([
      expect.objectContaining({
        id: "already-watched",
        items: {
          "123": expect.objectContaining({
            addedAt: 1710000000000,
          }),
          "movie-456": expect.objectContaining({
            addedAt: 1710000005000,
          }),
        },
      }),
    ])
  })
})

describe("createList", () => {
  it("stores a trimmed description on the created list", async () => {
    const { listId, transaction } = await runCreateListWithCurrentDoc({
      exists: () => false,
    })

    expect(listId).toBe("road-trip")
    expect(transaction.set).toHaveBeenCalledWith(
      { path: "users/user-1/lists/road-trip" },
      {
        id: "road-trip",
        name: "Road Trip",
        description: "Weekend plans",
        items: {},
        createdAt: "server-timestamp",
        isCustom: true,
      },
    )
  })
})

describe("updateList", () => {
  it("trims the name and description when updating a list", async () => {
    await updateList(
      "user-1",
      "road-trip",
      "  Road Trip  ",
      "  Weekend plans for the drive  ",
    )

    expect(updateDoc).toHaveBeenCalledWith(
      { path: "users/user-1/lists/road-trip" },
      {
        name: "Road Trip",
        description: "Weekend plans for the drive",
        updatedAt: "server-timestamp",
      },
    )
    expect(deleteField).not.toHaveBeenCalled()
  })

  it("clears the description when blank text is provided", async () => {
    await updateList("user-1", "road-trip", "Road Trip", "   ")

    expect(deleteField).toHaveBeenCalled()
    expect(updateDoc).toHaveBeenCalledWith(
      { path: "users/user-1/lists/road-trip" },
      {
        name: "Road Trip",
        description: "delete-field-token",
        updatedAt: "server-timestamp",
      },
    )
  })

  it("leaves the description untouched when it is omitted", async () => {
    await updateList("user-1", "road-trip", "Road Trip")

    expect(updateDoc).toHaveBeenCalledWith(
      { path: "users/user-1/lists/road-trip" },
      {
        name: "Road Trip",
        updatedAt: "server-timestamp",
      },
    )
  })
})

describe("addToList", () => {
  it("preserves a provided addedAt timestamp", async () => {
    const { wasAdded, transaction } = await runAddToListWithCurrentDoc(
      {
        exists: () => false,
      },
      {
        id: 123,
        title: "Mad Max",
        poster_path: null,
        media_type: "movie",
        addedAt: 111,
      },
    )

    expect(wasAdded).toBe(true)
    expect(transaction.set).toHaveBeenCalledWith(
      { path: "users/user-1/lists/watchlist" },
      {
        name: "Should Watch",
        items: {
          "123": {
            id: 123,
            title: "Mad Max",
            poster_path: null,
            media_type: "movie",
            addedAt: 111,
          },
        },
        updatedAt: "server-timestamp",
        createdAt: "server-timestamp",
      },
    )
  })

  it("defaults addedAt when one is not provided", async () => {
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(9999)

    try {
      const { wasAdded, transaction } = await runAddToListWithCurrentDoc(
        {
          exists: () => true,
          data: () => ({
            items: {},
          }),
        },
        {
          id: 123,
          title: "Mad Max",
          poster_path: null,
          media_type: "movie",
        },
      )

      expect(wasAdded).toBe(true)
      expect(transaction.set).toHaveBeenCalledWith(
        { path: "users/user-1/lists/watchlist" },
        {
          name: "Should Watch",
          items: {
            "123": {
              id: 123,
              title: "Mad Max",
              poster_path: null,
              media_type: "movie",
              addedAt: 9999,
            },
          },
          updatedAt: "server-timestamp",
        },
        { merge: true },
      )
    } finally {
      nowSpy.mockRestore()
    }
  })
})

describe("removeMediaFromList", () => {
  it("removes both legacy and prefixed keys in one write", async () => {
    await removeMediaFromList("user-1", "watchlist", 123, "movie")

    expect(setDoc).toHaveBeenCalledWith(
      { path: "users/user-1/lists/watchlist" },
      {
        items: {
          "123": "delete-field-token",
          "movie-123": "delete-field-token",
        },
        updatedAt: "server-timestamp",
      },
      { merge: true },
    )
  })
})

describe("restoreList", () => {
  it("restores the list when the target document does not exist", async () => {
    const { restored, transaction } = await runRestoreListWithCurrentDoc({
      exists: () => false,
    })

    expect(restored).toBe(true)
    expect(doc).toHaveBeenCalledWith(
      dbMock,
      "users",
      "user-1",
      "lists",
      "road-trip",
    )
    expect(transaction.set).toHaveBeenCalledWith(
      { path: "users/user-1/lists/road-trip" },
      {
        id: "road-trip",
        name: "Road Trip",
        description: "Weekend plans",
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

  it("restores the list when the existing document is not newer", async () => {
    const { restored, transaction } = await runRestoreListWithCurrentDoc({
      exists: () => true,
      data: () => ({
        updatedAt: 5678,
      }),
    })

    expect(restored).toBe(true)
    expect(transaction.set).toHaveBeenCalledWith(
      { path: "users/user-1/lists/road-trip" },
      expect.objectContaining({
        id: "road-trip",
        updatedAt: 5678,
      }),
    )
  })

  it("skips the restore when the existing document is newer", async () => {
    const { restored, transaction } = await runRestoreListWithCurrentDoc({
      exists: () => true,
      data: () => ({
        updatedAt: 7000,
      }),
    })

    expect(restored).toBe(false)
    expect(transaction.set).not.toHaveBeenCalled()
  })

  it("skips the restore when the existing document updatedAt is not comparable", async () => {
    const { restored, transaction } = await runRestoreListWithCurrentDoc({
      exists: () => true,
      data: () => ({}),
    })

    expect(restored).toBe(false)
    expect(transaction.set).not.toHaveBeenCalled()
  })

  it("skips the restore when the snapshot updatedAt is missing and the doc exists", async () => {
    const { restored, transaction } = await runRestoreListWithCurrentDoc(
      {
        exists: () => true,
        data: () => ({
          updatedAt: 1000,
        }),
      },
      {
        ...createRestoreListPayload(),
        updatedAt: undefined,
      },
    )

    expect(restored).toBe(false)
    expect(transaction.set).not.toHaveBeenCalled()
  })

  it("restores when both timestamps are timestamp-like and the current doc is older", async () => {
    const timestampUpdatedAt = createTimestampLike(5678)
    const { restored, transaction } = await runRestoreListWithCurrentDoc(
      {
        exists: () => true,
        data: () => ({
          updatedAt: createTimestampLike(5000),
        }),
      },
      {
        ...createRestoreListPayload(),
        updatedAt: timestampUpdatedAt as never,
      },
    )

    expect(restored).toBe(true)
    expect(transaction.set).toHaveBeenCalledWith(
      { path: "users/user-1/lists/road-trip" },
      expect.objectContaining({
        updatedAt: timestampUpdatedAt,
      }),
    )
  })

  it("skips when both timestamps are timestamp-like and the current doc is newer", async () => {
    const { restored, transaction } = await runRestoreListWithCurrentDoc(
      {
        exists: () => true,
        data: () => ({
          updatedAt: createTimestampLike(8000),
        }),
      },
      {
        ...createRestoreListPayload(),
        updatedAt: createTimestampLike(5678) as never,
      },
    )

    expect(restored).toBe(false)
    expect(transaction.set).not.toHaveBeenCalled()
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

    expect(runTransaction).not.toHaveBeenCalled()
  })
})
