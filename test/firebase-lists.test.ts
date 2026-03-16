import { fetchUserList, restoreList } from "@/lib/firebase/lists"
import { doc, getDoc, runTransaction } from "firebase/firestore"
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

function createRestoreListPayload(): Parameters<typeof restoreList>[1] {
  return {
    id: "road-trip",
    name: "Road Trip",
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

function createTimestampLike(millis: number) {
  return {
    toMillis: () => millis,
  }
}

async function runRestoreListWithCurrentDoc(currentDoc: {
  exists: () => boolean
  data?: () => Record<string, unknown>
}, list: Parameters<typeof restoreList>[1] = createRestoreListPayload()) {
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
