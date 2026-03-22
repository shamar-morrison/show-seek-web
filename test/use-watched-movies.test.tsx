import { useWatchedMovies } from "@/hooks/use-watched-movies"
import { queryKeys } from "@/lib/react-query/query-keys"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const addWatchMock = vi.fn()
const addWatchedMovieToTrackedCollectionMock = vi.fn()
const applyWatchedMovieListAutomationMock = vi.fn()
const clearWatchesMock = vi.fn()
const deleteWatchMock = vi.fn()
const fetchAllTrackedCollectionsMock = vi.fn()
const fetchMovieDetailsMock = vi.fn()
const fetchWatchesMock = vi.fn()
const getWatchCountMock = vi.fn()
const removeWatchedMovieFromTrackedCollectionMock = vi.fn()
const toastErrorMock = vi.fn()
const toastSuccessMock = vi.fn()
const updateWatchMock = vi.fn()

vi.mock("@/app/actions", () => ({
  fetchMovieDetails: (...args: unknown[]) => fetchMovieDetailsMock(...args),
}))

vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({
    user: {
      uid: "user-1",
      isAnonymous: false,
    },
    loading: false,
  }),
}))

vi.mock("@/hooks/use-list-mutations", () => ({
  useListMutations: () => ({
    addToList: vi.fn(),
    removeFromList: vi.fn(),
  }),
}))

vi.mock("@/lib/firebase/collection-tracking", () => ({
  addWatchedMovieToTrackedCollection: (...args: unknown[]) =>
    addWatchedMovieToTrackedCollectionMock(...args),
  fetchAllTrackedCollections: (...args: unknown[]) =>
    fetchAllTrackedCollectionsMock(...args),
  removeWatchedMovieFromTrackedCollection: (...args: unknown[]) =>
    removeWatchedMovieFromTrackedCollectionMock(...args),
}))

vi.mock("@/lib/firebase/watched-movies", () => ({
  addWatch: (...args: unknown[]) => addWatchMock(...args),
  clearWatches: (...args: unknown[]) => clearWatchesMock(...args),
  deleteWatch: (...args: unknown[]) => deleteWatchMock(...args),
  fetchWatches: (...args: unknown[]) => fetchWatchesMock(...args),
  getWatchCount: (...args: unknown[]) => getWatchCountMock(...args),
  updateWatch: (...args: unknown[]) => updateWatchMock(...args),
  WatchInstance: class {},
}))

vi.mock("@/lib/movie-list-automation", () => ({
  applyWatchedMovieListAutomation: (...args: unknown[]) =>
    applyWatchedMovieListAutomationMock(...args),
}))

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastErrorMock(...args),
    success: (...args: unknown[]) => toastSuccessMock(...args),
  },
}))

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
}

function createWrapper(queryClient = createTestQueryClient()) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
}

function createDeferredPromise<T>() {
  let resolve!: (value: T) => void

  const promise = new Promise<T>((res) => {
    resolve = res
  })

  return { promise, resolve }
}

describe("useWatchedMovies collection sync", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchWatchesMock.mockResolvedValue([])
    getWatchCountMock.mockResolvedValue(0)
    addWatchMock.mockResolvedValue("watch-1")
    clearWatchesMock.mockResolvedValue(undefined)
    deleteWatchMock.mockResolvedValue(undefined)
    applyWatchedMovieListAutomationMock.mockResolvedValue(undefined)
    addWatchedMovieToTrackedCollectionMock.mockResolvedValue(undefined)
    removeWatchedMovieFromTrackedCollectionMock.mockResolvedValue(undefined)
    fetchAllTrackedCollectionsMock.mockResolvedValue([])
    updateWatchMock.mockResolvedValue(undefined)
  })

  it("syncs collection tracking immediately when collection id is provided", async () => {
    const { result } = renderHook(
      () => useWatchedMovies(501, { enabled: false }),
      {
        wrapper: createWrapper(),
      },
    )

    await act(async () => {
      await result.current.addWatchInstance(
        new Date("2026-03-10T20:00:00.000Z"),
        {
          title: "Movie",
          posterPath: null,
          collectionId: 44,
        },
        false,
        false,
      )
    })

    expect(addWatchMock).toHaveBeenCalledWith(
      "user-1",
      501,
      new Date("2026-03-10T20:00:00.000Z"),
    )
    expect(addWatchedMovieToTrackedCollectionMock).toHaveBeenCalledWith(
      "user-1",
      44,
      501,
    )
    expect(fetchMovieDetailsMock).not.toHaveBeenCalled()
    expect(toastSuccessMock).toHaveBeenCalledWith(
      "Marked as watched",
      expect.objectContaining({
        action: expect.objectContaining({
          label: "Undo",
          onClick: expect.any(Function),
        }),
      }),
    )
  })

  it("defers collection resolution when the caller does not provide one", async () => {
    const deferredMovieDetails = createDeferredPromise<{
      belongs_to_collection: { id: number }
    }>()
    fetchMovieDetailsMock.mockReturnValueOnce(deferredMovieDetails.promise)

    const { result } = renderHook(
      () => useWatchedMovies(777, { enabled: false }),
      {
        wrapper: createWrapper(),
      },
    )

    let addWatchPromise!: Promise<void>

    await act(async () => {
      addWatchPromise = result.current.addWatchInstance(
        new Date("2026-03-10T20:05:00.000Z"),
        {
          title: "Movie",
          posterPath: null,
        },
        false,
        false,
      )

      await Promise.resolve()
    })

    await expect(addWatchPromise).resolves.toBeUndefined()

    expect(fetchMovieDetailsMock).toHaveBeenCalledWith(777)
    expect(addWatchedMovieToTrackedCollectionMock).not.toHaveBeenCalled()

    deferredMovieDetails.resolve({
      belongs_to_collection: { id: 88 },
    })

    await waitFor(() => {
      expect(addWatchedMovieToTrackedCollectionMock).toHaveBeenCalledWith(
        "user-1",
        88,
        777,
      )
    })
  })

  it("removes cleared movies from tracked collections", async () => {
    fetchAllTrackedCollectionsMock.mockResolvedValueOnce([
      {
        collectionId: 10,
        watchedMovieIds: [900],
      },
      {
        collectionId: 11,
        watchedMovieIds: [700, 900],
      },
    ])

    const { result } = renderHook(
      () => useWatchedMovies(900, { enabled: false }),
      {
        wrapper: createWrapper(),
      },
    )

    await act(async () => {
      await result.current.clearAllWatches()
    })

    expect(fetchAllTrackedCollectionsMock).toHaveBeenCalledWith("user-1")
    expect(removeWatchedMovieFromTrackedCollectionMock).toHaveBeenCalledTimes(2)
    expect(removeWatchedMovieFromTrackedCollectionMock).toHaveBeenCalledWith(
      "user-1",
      10,
      900,
    )
    expect(removeWatchedMovieFromTrackedCollectionMock).toHaveBeenCalledWith(
      "user-1",
      11,
      900,
    )
    expect(toastSuccessMock).toHaveBeenCalledWith(
      "Watch history cleared",
      expect.objectContaining({
        action: expect.objectContaining({
          label: "Undo",
          onClick: expect.any(Function),
        }),
      }),
    )
  })

  it("undoes a newly added watch from the success toast action", async () => {
    getWatchCountMock
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)

    const { result } = renderHook(
      () => useWatchedMovies(501, { enabled: false }),
      {
        wrapper: createWrapper(),
      },
    )

    await act(async () => {
      await result.current.addWatchInstance(
        new Date("2026-03-10T20:00:00.000Z"),
        {
          title: "Movie",
          posterPath: null,
          collectionId: 44,
        },
        false,
        false,
      )
    })

    const toastOptions = toastSuccessMock.mock.calls[0]?.[1] as
      | { action?: { onClick: () => void } }
      | undefined

    await act(async () => {
      toastOptions?.action?.onClick()
      await Promise.resolve()
    })

    expect(deleteWatchMock).toHaveBeenCalledWith("user-1", 501, "watch-1")
    expect(removeWatchedMovieFromTrackedCollectionMock).toHaveBeenCalledWith(
      "user-1",
      44,
      501,
    )
  })

  it("restores cleared watches from the success toast action", async () => {
    fetchAllTrackedCollectionsMock.mockResolvedValueOnce([
      {
        collectionId: 10,
        watchedMovieIds: [900],
      },
    ])
    fetchWatchesMock.mockResolvedValueOnce([
      {
        id: "watch-a",
        movieId: 900,
        watchedAt: new Date("2026-03-09T19:00:00.000Z"),
      },
      {
        id: "watch-b",
        movieId: 900,
        watchedAt: new Date("2026-03-08T19:00:00.000Z"),
      },
    ])

    const { result } = renderHook(
      () => useWatchedMovies(900),
      {
        wrapper: createWrapper(),
      },
    )

    await waitFor(() => {
      expect(result.current.instances).toHaveLength(2)
    })

    await act(async () => {
      await result.current.clearAllWatches()
    })

    const toastOptions = toastSuccessMock.mock.calls.at(-1)?.[1] as
      | { action?: { onClick: () => void } }
      | undefined

    await act(async () => {
      toastOptions?.action?.onClick()
      await Promise.resolve()
    })

    expect(addWatchMock).toHaveBeenCalledWith(
      "user-1",
      900,
      new Date("2026-03-09T19:00:00.000Z"),
    )
    expect(addWatchMock).toHaveBeenCalledWith(
      "user-1",
      900,
      new Date("2026-03-08T19:00:00.000Z"),
    )
    expect(addWatchedMovieToTrackedCollectionMock).toHaveBeenCalledWith(
      "user-1",
      10,
      900,
    )
  })

  it("optimistically removes a single watch instance before delete resolves", async () => {
    const deleteDeferred = createDeferredPromise<void>()
    deleteWatchMock.mockReturnValueOnce(deleteDeferred.promise)
    getWatchCountMock.mockResolvedValueOnce(1)
    fetchWatchesMock.mockResolvedValueOnce([
      {
        id: "watch-a",
        movieId: 900,
        watchedAt: new Date("2026-03-09T19:00:00.000Z"),
      },
      {
        id: "watch-b",
        movieId: 900,
        watchedAt: new Date("2026-03-08T19:00:00.000Z"),
      },
    ])

    const { result } = renderHook(() => useWatchedMovies(900), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.instances).toHaveLength(2)
    })

    let deletePromise!: Promise<void>
    await act(async () => {
      deletePromise = result.current.deleteWatchInstance("watch-a")
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(result.current.instances).toEqual([
        {
          id: "watch-b",
          movieId: 900,
          watchedAt: new Date("2026-03-08T19:00:00.000Z"),
        },
      ])
    })

    deleteDeferred.resolve(undefined)

    await act(async () => {
      await deletePromise
    })

    expect(deleteWatchMock).toHaveBeenCalledWith("user-1", 900, "watch-a")
    expect(toastSuccessMock).toHaveBeenCalledWith(
      "Watch deleted",
      expect.objectContaining({
        action: expect.objectContaining({
          label: "Undo",
          onClick: expect.any(Function),
        }),
      }),
    )
  })

  it("syncs collection tracking when deleting the last watch instance", async () => {
    fetchWatchesMock.mockResolvedValueOnce([
      {
        id: "watch-a",
        movieId: 900,
        watchedAt: new Date("2026-03-09T19:00:00.000Z"),
      },
    ])
    getWatchCountMock.mockResolvedValueOnce(0)
    fetchAllTrackedCollectionsMock.mockResolvedValueOnce([
      {
        collectionId: 10,
        watchedMovieIds: [900],
      },
    ])

    const { result } = renderHook(() => useWatchedMovies(900), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.instances).toHaveLength(1)
    })

    await act(async () => {
      await result.current.deleteWatchInstance("watch-a")
    })

    expect(deleteWatchMock).toHaveBeenCalledWith("user-1", 900, "watch-a")
    await waitFor(() => {
      expect(fetchAllTrackedCollectionsMock).toHaveBeenCalledWith("user-1")
    })
    await waitFor(() => {
      expect(removeWatchedMovieFromTrackedCollectionMock).toHaveBeenCalledWith(
        "user-1",
        10,
        900,
      )
    })
    expect(toastSuccessMock).toHaveBeenCalledWith(
      "Watch deleted",
      expect.objectContaining({
        action: expect.objectContaining({
          label: "Undo",
          onClick: expect.any(Function),
        }),
      }),
    )
  })

  it("does not sync collection tracking when a concurrent add leaves another watch in cache", async () => {
    const deleteDeferred = createDeferredPromise<void>()
    const concurrentWatch = {
      id: "watch-b",
      movieId: 900,
      watchedAt: new Date("2026-03-08T19:00:00.000Z"),
    }

    deleteWatchMock.mockReturnValueOnce(deleteDeferred.promise)
    fetchWatchesMock
      .mockResolvedValueOnce([
        {
          id: "watch-a",
          movieId: 900,
          watchedAt: new Date("2026-03-09T19:00:00.000Z"),
        },
      ])
      .mockResolvedValue([concurrentWatch])

    const queryClient = createTestQueryClient()
    const { result } = renderHook(() => useWatchedMovies(900), {
      wrapper: createWrapper(queryClient),
    })

    await waitFor(() => {
      expect(result.current.instances).toHaveLength(1)
    })

    let deletePromise!: Promise<void>
    await act(async () => {
      deletePromise = result.current.deleteWatchInstance("watch-a")
      await Promise.resolve()
    })

    await act(async () => {
      queryClient.setQueryData(
        queryKeys.firestore.watchedMovies("user-1", 900),
        [concurrentWatch],
      )
    })

    deleteDeferred.resolve(undefined)

    await act(async () => {
      await deletePromise
    })

    expect(fetchAllTrackedCollectionsMock).not.toHaveBeenCalled()
    expect(removeWatchedMovieFromTrackedCollectionMock).not.toHaveBeenCalled()
    expect(getWatchCountMock).not.toHaveBeenCalled()
    expect(toastSuccessMock).toHaveBeenCalledWith(
      "Watch deleted",
      expect.objectContaining({
        action: expect.objectContaining({
          label: "Undo",
          onClick: expect.any(Function),
        }),
      }),
    )
  })

  it("restores a deleted watch and collection tracking from the success toast action", async () => {
    const deletedWatchDate = new Date("2026-03-09T19:00:00.000Z")

    fetchWatchesMock.mockResolvedValueOnce([
      {
        id: "watch-a",
        movieId: 900,
        watchedAt: deletedWatchDate,
      },
    ])
    fetchAllTrackedCollectionsMock.mockResolvedValueOnce([
      {
        collectionId: 10,
        watchedMovieIds: [900],
      },
    ])

    const { result } = renderHook(() => useWatchedMovies(900), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.instances).toHaveLength(1)
    })

    await act(async () => {
      await result.current.deleteWatchInstance("watch-a")
    })

    const toastOptions = toastSuccessMock.mock.calls.at(-1)?.[1] as
      | { action?: { onClick: () => void } }
      | undefined

    await act(async () => {
      toastOptions?.action?.onClick()
      await Promise.resolve()
    })

    expect(addWatchMock).toHaveBeenCalledWith("user-1", 900, deletedWatchDate)
    expect(addWatchedMovieToTrackedCollectionMock).toHaveBeenCalledWith(
      "user-1",
      10,
      900,
    )
  })

  it("shows an error toast when deleting a watch fails", async () => {
    deleteWatchMock.mockRejectedValueOnce(new Error("delete failed"))
    fetchWatchesMock.mockResolvedValueOnce([
      {
        id: "watch-a",
        movieId: 900,
        watchedAt: new Date("2026-03-09T19:00:00.000Z"),
      },
    ])

    const { result } = renderHook(() => useWatchedMovies(900), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.instances).toHaveLength(1)
    })

    await expect(
      result.current.deleteWatchInstance("watch-a"),
    ).rejects.toThrow("delete failed")

    expect(toastErrorMock).toHaveBeenCalledWith(
      "Failed to delete watch: delete failed",
    )
  })

  it("optimistically updates and re-sorts a watch instance after editing", async () => {
    const updateDeferred = createDeferredPromise<void>()
    updateWatchMock.mockReturnValueOnce(updateDeferred.promise)
    fetchWatchesMock.mockResolvedValueOnce([
      {
        id: "watch-new",
        movieId: 900,
        watchedAt: new Date("2026-03-09T19:00:00.000Z"),
      },
      {
        id: "watch-old",
        movieId: 900,
        watchedAt: new Date("2026-03-08T19:00:00.000Z"),
      },
    ])

    const { result } = renderHook(() => useWatchedMovies(900), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.instances).toHaveLength(2)
    })

    const updatedDate = new Date("2026-03-10T19:00:00.000Z")

    let updatePromise!: Promise<void>
    await act(async () => {
      updatePromise = result.current.updateWatchInstance("watch-old", updatedDate)
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(result.current.instances.map((watch) => watch.id)).toEqual([
        "watch-old",
        "watch-new",
      ])
    })
    expect(result.current.instances[0]?.watchedAt).toEqual(updatedDate)

    updateDeferred.resolve(undefined)

    await act(async () => {
      await updatePromise
    })

    expect(updateWatchMock).toHaveBeenCalledWith(
      "user-1",
      900,
      "watch-old",
      updatedDate,
    )
    expect(toastSuccessMock).toHaveBeenCalledWith("Watch date updated")
  })

  it("shows an error toast when updating a watch fails", async () => {
    updateWatchMock.mockRejectedValueOnce(new Error("update failed"))
    fetchWatchesMock.mockResolvedValueOnce([
      {
        id: "watch-old",
        movieId: 900,
        watchedAt: new Date("2026-03-08T19:00:00.000Z"),
      },
    ])

    const { result } = renderHook(() => useWatchedMovies(900), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.instances).toHaveLength(1)
    })

    await expect(
      result.current.updateWatchInstance(
        "watch-old",
        new Date("2026-03-10T19:00:00.000Z"),
      ),
    ).rejects.toThrow("update failed")

    expect(toastErrorMock).toHaveBeenCalledWith(
      "Failed to update watch: update failed",
    )
  })
})
