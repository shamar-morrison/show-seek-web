import { useWatchedMovies } from "@/hooks/use-watched-movies"
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

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

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
})
