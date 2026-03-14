import { useReleaseCalendar } from "@/hooks/use-release-calendar"
import type { ReleaseCalendarRelease } from "@/types/release-calendar"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const fetchReleaseCalendarReleasesMock = vi.fn()
const useAuthMock = vi.fn()
const useListsMock = vi.fn()
const usePreferencesMock = vi.fn()

vi.mock("@/app/actions", () => ({
  fetchReleaseCalendarReleases: (...args: unknown[]) =>
    fetchReleaseCalendarReleasesMock(...args),
}))

vi.mock("@/context/auth-context", () => ({
  useAuth: () => useAuthMock(),
}))

vi.mock("@/hooks/use-lists", () => ({
  useLists: () => useListsMock(),
}))

vi.mock("@/hooks/use-preferences", () => ({
  usePreferences: () => usePreferencesMock(),
}))

vi.mock("@/lib/tmdb-date", async () => {
  const actual = await vi.importActual<typeof import("@/lib/tmdb-date")>(
    "@/lib/tmdb-date",
  )

  return {
    ...actual,
    getTodayDateKey: () => "2026-05-01",
  }
})

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
}

function createDeferred<T>() {
  let reject!: (error?: unknown) => void
  let resolve!: (value: T) => void

  const promise = new Promise<T>((nextResolve, nextReject) => {
    reject = nextReject
    resolve = nextResolve
  })

  return {
    promise,
    reject,
    resolve,
  }
}

describe("useReleaseCalendar", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    useAuthMock.mockReturnValue({
      loading: false,
      user: {
        isAnonymous: false,
        uid: "user-1",
      },
    })

    usePreferencesMock.mockReturnValue({
      isLoading: false,
      region: "US",
    })
  })

  it("fetches releases with a single batched query and exposes movie fallback data while pending", async () => {
    const releasesDeferred = createDeferred<ReleaseCalendarRelease[]>()

    useListsMock.mockReturnValue({
      error: null,
      lists: [
        {
          id: "watchlist",
          items: {
            1: {
              addedAt: 1,
              id: 1,
              media_type: "movie",
              poster_path: "/movie.jpg",
              release_date: "2026-05-20",
              title: "Movie",
            },
          },
        },
        {
          id: "currently-watching",
          items: {
            2: {
              addedAt: 1,
              first_air_date: "2024-01-01",
              id: 2,
              media_type: "tv",
              name: "Show",
              poster_path: "/show.jpg",
              title: "Show",
            },
          },
        },
      ],
      loading: false,
    })

    fetchReleaseCalendarReleasesMock.mockReturnValueOnce(releasesDeferred.promise)

    const { result } = renderHook(() => useReleaseCalendar(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(fetchReleaseCalendarReleasesMock).toHaveBeenCalledTimes(1)
    })

    expect(fetchReleaseCalendarReleasesMock).toHaveBeenCalledWith({
      items: [
        {
          id: 2,
          mediaType: "tv",
          title: "Show",
          name: "Show",
          posterPath: "/show.jpg",
          releaseDate: undefined,
          firstAirDate: "2024-01-01",
          sourceList: "currently-watching",
        },
        {
          id: 1,
          mediaType: "movie",
          title: "Movie",
          name: undefined,
          posterPath: "/movie.jpg",
          releaseDate: "2026-05-20",
          firstAirDate: undefined,
          sourceList: "watchlist",
        },
      ],
      region: "US",
      todayKey: "2026-05-01",
    })

    expect(result.current.isBootstrapping).toBe(false)
    expect(result.current.isRefreshing).toBe(true)
    expect(result.current.error).toBeNull()
    expect(result.current.releases).toEqual([
      expect.objectContaining({
        mediaType: "movie",
        releaseDate: "2026-05-20",
        uniqueKey: "movie-1",
      }),
    ])

    releasesDeferred.resolve([
      {
        id: 2,
        mediaType: "tv",
        title: "Show",
        posterPath: "/show.jpg",
        backdropPath: "/show-backdrop.jpg",
        releaseDate: "2026-05-12",
        nextEpisode: {
          seasonNumber: 3,
          episodeNumber: 1,
          episodeName: "Premiere",
        },
        sourceLists: ["currently-watching"],
        uniqueKey: "tv-2-s3-e1",
      },
      {
        id: 1,
        mediaType: "movie",
        title: "Movie",
        posterPath: "/movie.jpg",
        backdropPath: "/movie-backdrop.jpg",
        releaseDate: "2026-05-18",
        sourceLists: ["watchlist"],
        uniqueKey: "movie-1",
      },
    ])

    await waitFor(() => {
      expect(result.current.isRefreshing).toBe(false)
    })

    expect(result.current.releases.map((release) => release.uniqueKey)).toEqual([
      "tv-2-s3-e1",
      "movie-1",
    ])
  })

  it("does not stay in bootstrap mode for tv-only accounts while preferences or enrichment are pending", async () => {
    const releasesDeferred = createDeferred<ReleaseCalendarRelease[]>()

    usePreferencesMock.mockReturnValue({
      isLoading: true,
      region: "US",
    })

    useListsMock.mockReturnValue({
      error: null,
      lists: [
        {
          id: "currently-watching",
          items: {
            2: {
              addedAt: 1,
              first_air_date: "2024-01-01",
              id: 2,
              media_type: "tv",
              name: "Show",
              poster_path: "/show.jpg",
              title: "Show",
            },
          },
        },
      ],
      loading: false,
    })

    fetchReleaseCalendarReleasesMock.mockReturnValueOnce(releasesDeferred.promise)

    const { result } = renderHook(() => useReleaseCalendar(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(fetchReleaseCalendarReleasesMock).toHaveBeenCalledTimes(1)
    })

    expect(result.current.isBootstrapping).toBe(false)
    expect(result.current.isRefreshing).toBe(true)
    expect(result.current.releases).toEqual([])

    releasesDeferred.resolve([])

    await waitFor(() => {
      expect(result.current.isRefreshing).toBe(false)
      expect(result.current.releases).toEqual([])
    })
  })
})
