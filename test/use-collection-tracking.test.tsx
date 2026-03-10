import {
  useCanTrackMoreCollections,
  useCollectionProgressList,
  useCollectionTracking,
  useStartCollectionTracking,
} from "@/hooks/use-collection-tracking"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const fetchCollectionTrackingMock = vi.fn()
const fetchAllTrackedCollectionsMock = vi.fn()
const fetchCollectionMock = vi.fn()
const getTrackedCollectionCountMock = vi.fn()
const getPreviouslyWatchedMovieIdsMock = vi.fn()
const startCollectionTrackingMock = vi.fn()

vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({
    user: {
      uid: "user-1",
      isAnonymous: false,
    },
    isPremium: false,
  }),
}))

vi.mock("@/app/actions", () => ({
  fetchCollection: (...args: unknown[]) => fetchCollectionMock(...args),
}))

vi.mock("@/lib/firebase/collection-tracking", () => ({
  MAX_FREE_COLLECTIONS: 2,
  addWatchedMovieToTrackedCollection: vi.fn(),
  fetchAllTrackedCollections: (...args: unknown[]) =>
    fetchAllTrackedCollectionsMock(...args),
  fetchCollectionTracking: (...args: unknown[]) =>
    fetchCollectionTrackingMock(...args),
  getPreviouslyWatchedMovieIds: (...args: unknown[]) =>
    getPreviouslyWatchedMovieIdsMock(...args),
  getTrackedCollectionCount: (...args: unknown[]) =>
    getTrackedCollectionCountMock(...args),
  removeWatchedMovieFromTrackedCollection: vi.fn(),
  startCollectionTracking: (...args: unknown[]) =>
    startCollectionTrackingMock(...args),
  stopCollectionTracking: vi.fn(),
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

describe("useCollectionTracking", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("derives watched count and percentage for a tracked collection", async () => {
    fetchCollectionTrackingMock.mockResolvedValueOnce({
      collectionId: 44,
      name: "John Wick Collection",
      totalMovies: 4,
      watchedMovieIds: [1, 2, 3],
      startedAt: 100,
      lastUpdated: 200,
    })

    const { result } = renderHook(() => useCollectionTracking(44), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.isTracked).toBe(true)
    expect(result.current.watchedCount).toBe(3)
    expect(result.current.totalMovies).toBe(4)
    expect(result.current.percentage).toBe(75)
  })

  it("enforces the free tracking limit for non-premium users", async () => {
    getTrackedCollectionCountMock.mockResolvedValueOnce(2)

    const { result } = renderHook(() => useCanTrackMoreCollections(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.count).toBe(2)
    expect(result.current.canTrackMore).toBe(false)
    expect(result.current.maxFreeCollections).toBe(2)
  })

  it("backfills watched movie ids when tracking starts", async () => {
    getPreviouslyWatchedMovieIdsMock.mockResolvedValueOnce([101, 103])
    startCollectionTrackingMock.mockResolvedValueOnce(undefined)

    const { result } = renderHook(() => useStartCollectionTracking(), {
      wrapper: createWrapper(),
    })

    await act(async () => {
      await result.current.mutateAsync({
        collectionId: 7,
        name: "Spider-Man Collection",
        totalMovies: 3,
        collectionMovieIds: [101, 102, 103],
      })
    })

    expect(getPreviouslyWatchedMovieIdsMock).toHaveBeenCalledWith("user-1", [
      101,
      102,
      103,
    ])
    expect(startCollectionTrackingMock).toHaveBeenCalledWith(
      "user-1",
      7,
      "Spider-Man Collection",
      3,
      [101, 103],
    )
  })

  it("builds collection progress items with TMDB artwork", async () => {
    fetchAllTrackedCollectionsMock.mockResolvedValueOnce([
      {
        collectionId: 90,
        name: "Dune Collection",
        totalMovies: 3,
        watchedMovieIds: [1, 2],
        startedAt: 100,
        lastUpdated: 300,
      },
    ])
    fetchCollectionMock.mockResolvedValueOnce({
      poster_path: "/poster.jpg",
      backdrop_path: "/backdrop.jpg",
    })

    const { result } = renderHook(() => useCollectionProgressList(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.progressItems).toEqual([
      {
        collectionId: 90,
        name: "Dune Collection",
        posterPath: "/poster.jpg",
        backdropPath: "/backdrop.jpg",
        watchedCount: 2,
        totalMovies: 3,
        percentage: 67,
        lastUpdated: 300,
      },
    ])
    expect(result.current.isEmpty).toBe(false)
  })
})
