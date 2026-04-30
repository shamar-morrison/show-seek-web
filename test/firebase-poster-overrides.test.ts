import { setPosterOverride } from "@/lib/firebase/poster-overrides"
import { POSTER_OVERRIDE_MAX_ENTRIES } from "@/lib/poster-overrides"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  db: {},
  doc: vi.fn((_db, ...segments: string[]) => ({
    path: segments.join("/"),
  })),
  runTransaction: vi.fn(),
}))

vi.mock("@/lib/firebase/config", () => ({
  getFirebaseDb: vi.fn(() => mocks.db),
}))

vi.mock("firebase/firestore", () => ({
  deleteField: vi.fn(() => "delete-field-token"),
  doc: mocks.doc,
  runTransaction: mocks.runTransaction,
  setDoc: vi.fn(async () => {}),
  updateDoc: vi.fn(async () => {}),
}))

function createSnapshot(data?: Record<string, unknown>) {
  return {
    data: () => data,
    exists: () => data !== undefined,
  }
}

function createPosterOverrides(count: number): Record<string, string> {
  return Object.fromEntries(
    Array.from({ length: count }, (_, index) => [
      `movie_${index}`,
      `/poster-${index}.jpg`,
    ]),
  )
}

describe("firebase poster overrides", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("writes the sanitized override map with a transaction update", async () => {
    const transaction = {
      get: vi.fn().mockResolvedValue(
        createSnapshot({
          preferences: {
            posterOverrides: {
              invalid: "poster.jpg",
              movie_1: "/poster-1.jpg",
              movie_2: "",
            },
          },
        }),
      ),
      set: vi.fn(),
      update: vi.fn(),
    }

    vi.mocked(mocks.runTransaction).mockImplementation(
      async (_db, callback) => {
        return (await callback(transaction as never)) as never
      },
    )

    await setPosterOverride("user-1", "tv", 7, "/poster-7.jpg")

    expect(transaction.get).toHaveBeenCalledWith({ path: "users/user-1" })
    expect(transaction.update).toHaveBeenCalledWith(
      { path: "users/user-1" },
      {
        "preferences.posterOverrides": {
          movie_1: "/poster-1.jpg",
          tv_7: "/poster-7.jpg",
        },
      },
    )
    expect(transaction.set).not.toHaveBeenCalled()
  })

  it("creates the user document inside the transaction when needed", async () => {
    const transaction = {
      get: vi.fn().mockResolvedValue(createSnapshot()),
      set: vi.fn(),
      update: vi.fn(),
    }

    vi.mocked(mocks.runTransaction).mockImplementation(
      async (_db, callback) => {
        return (await callback(transaction as never)) as never
      },
    )

    await setPosterOverride("user-1", "movie", 123, "/poster-123.jpg")

    expect(transaction.set).toHaveBeenCalledWith(
      { path: "users/user-1" },
      {
        preferences: {
          posterOverrides: {
            movie_123: "/poster-123.jpg",
          },
        },
      },
      { merge: true },
    )
    expect(transaction.update).not.toHaveBeenCalled()
  })

  it("rejects a new override when the transaction snapshot is already at the max", async () => {
    const transaction = {
      get: vi.fn().mockResolvedValue(
        createSnapshot({
          preferences: {
            posterOverrides: createPosterOverrides(POSTER_OVERRIDE_MAX_ENTRIES),
          },
        }),
      ),
      set: vi.fn(),
      update: vi.fn(),
    }

    vi.mocked(mocks.runTransaction).mockImplementation(
      async (_db, callback) => {
        return (await callback(transaction as never)) as never
      },
    )

    await expect(
      setPosterOverride("user-1", "tv", 1001, "/poster-1001.jpg"),
    ).rejects.toThrow(
      `You can save up to ${POSTER_OVERRIDE_MAX_ENTRIES} poster overrides`,
    )

    expect(transaction.set).not.toHaveBeenCalled()
    expect(transaction.update).not.toHaveBeenCalled()
  })

  it("allows updating an existing override when the transaction snapshot is at the max", async () => {
    const transaction = {
      get: vi.fn().mockResolvedValue(
        createSnapshot({
          preferences: {
            posterOverrides: createPosterOverrides(POSTER_OVERRIDE_MAX_ENTRIES),
          },
        }),
      ),
      set: vi.fn(),
      update: vi.fn(),
    }

    vi.mocked(mocks.runTransaction).mockImplementation(
      async (_db, callback) => {
        return (await callback(transaction as never)) as never
      },
    )

    await setPosterOverride("user-1", "movie", 42, "/replacement.jpg")

    expect(transaction.update).toHaveBeenCalledWith(
      { path: "users/user-1" },
      expect.objectContaining({
        "preferences.posterOverrides": expect.objectContaining({
          movie_42: "/replacement.jpg",
        }),
      }),
    )
    expect(transaction.set).not.toHaveBeenCalled()
  })
})
