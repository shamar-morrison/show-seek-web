import { useWatchedMovies } from "@/hooks/use-watched-movies"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const addWatchMock = vi.fn()
const addWatchedMovieToTrackedCollectionMock = vi.fn()
const applyWatchedMovieListAutomationMock = vi.fn()
const clearWatchesMock = vi.fn()
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

describe("useWatchedMovies collection sync", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchWatchesMock.mockResolvedValue([])
    getWatchCountMock.mockResolvedValue(0)
    addWatchMock.mockResolvedValue("watch-1")
    clearWatchesMock.mockResolvedValue(undefined)
    applyWatchedMovieListAutomationMock.mockResolvedValue(undefined)
    addWatchedMovieToTrackedCollectionMock.mockResolvedValue(undefined)
    removeWatchedMovieFromTrackedCollectionMock.mockResolvedValue(undefined)
    fetchAllTrackedCollectionsMock.mockResolvedValue([])
  })

  it("syncs collection tracking immediately when collection id is provided", async () => {
    const { result } = renderHook(() => useWatchedMovies(501, { enabled: false }), {
      wrapper: createWrapper(),
    })

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
  })

  it("resolves the collection id when the caller does not provide one", async () => {
    fetchMovieDetailsMock.mockResolvedValueOnce({
      belongs_to_collection: { id: 88 },
    })

    const { result } = renderHook(() => useWatchedMovies(777, { enabled: false }), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      await result.current.addWatchInstance(
        new Date("2026-03-10T20:05:00.000Z"),
        {
          title: "Movie",
          posterPath: null,
        },
        false,
        false,
      )
    })

    expect(fetchMovieDetailsMock).toHaveBeenCalledWith(777)
    expect(addWatchedMovieToTrackedCollectionMock).toHaveBeenCalledWith(
      "user-1",
      88,
      777,
    )
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

    const { result } = renderHook(() => useWatchedMovies(900, { enabled: false }), {
      wrapper: createWrapper(),
    })

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
  })
})
