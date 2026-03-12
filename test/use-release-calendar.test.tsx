import { useReleaseCalendar } from "@/hooks/use-release-calendar"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const fetchFullTVDetailsMock = vi.fn()
const fetchMovieDetailsMock = vi.fn()
const fetchSeasonEpisodesMock = vi.fn()
const useAuthMock = vi.fn()
const useListsMock = vi.fn()
const usePreferencesMock = vi.fn()

vi.mock("@/app/actions", () => ({
  fetchFullTVDetails: (...args: unknown[]) => fetchFullTVDetailsMock(...args),
  fetchMovieDetails: (...args: unknown[]) => fetchMovieDetailsMock(...args),
  fetchSeasonEpisodes: (...args: unknown[]) => fetchSeasonEpisodesMock(...args),
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

vi.mock("@/lib/react-query/rate-limited-query", () => ({
  createRateLimitedQueryFn: function <TArgs extends unknown[], TResult>(
    fn: (...args: TArgs) => Promise<TResult>,
  ) {
    return fn
  },
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

  it("loads releases incrementally from list data, then detail data, then season episodes", async () => {
    const movieDetailsDeferred = createDeferred<{
      backdrop_path: string | null
      release_date: string
      release_dates: {
        id: number
        results: Array<{
          iso_3166_1: string
          release_dates: Array<{
            certification: string
            iso_639_1: string
            release_date: string
            type: number
          }>
        }>
      }
    } | null>()
    const tvDetailsDeferred = createDeferred<{
      backdrop_path: string | null
      name: string
      next_episode_to_air: {
        air_date: string
        episode_number: number
        name: string
        season_number: number
      }
      seasons: Array<{
        season_number: number
      }>
      status: string
    } | null>()
    const seasonEpisodesDeferred = createDeferred<
      Array<{
        air_date: string | null
        episode_number: number
        id: number
        name: string
        runtime: number | null
      }>
    >()

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

    fetchMovieDetailsMock.mockReturnValueOnce(movieDetailsDeferred.promise)
    fetchFullTVDetailsMock.mockReturnValueOnce(tvDetailsDeferred.promise)
    fetchSeasonEpisodesMock.mockReturnValueOnce(seasonEpisodesDeferred.promise)

    const { result } = renderHook(() => useReleaseCalendar(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(fetchMovieDetailsMock).toHaveBeenCalledWith(1)
      expect(fetchFullTVDetailsMock).toHaveBeenCalledWith(2)
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.isFetching).toBe(true)
    expect(result.current.releases).toEqual([
      expect.objectContaining({
        mediaType: "movie",
        releaseDate: "2026-05-20",
        uniqueKey: "movie-1",
      }),
    ])

    movieDetailsDeferred.resolve({
      backdrop_path: "/movie-backdrop.jpg",
      release_date: "2026-05-20",
      release_dates: {
        id: 1,
        results: [
          {
            iso_3166_1: "US",
            release_dates: [
              {
                certification: "",
                iso_639_1: "",
                release_date: "2026-05-18T00:00:00.000Z",
                type: 3,
              },
            ],
          },
        ],
      },
    })

    await waitFor(() => {
      expect(result.current.releases).toEqual([
        expect.objectContaining({
          backdropPath: "/movie-backdrop.jpg",
          releaseDate: "2026-05-18",
          uniqueKey: "movie-1",
        }),
      ])
    })

    tvDetailsDeferred.resolve({
      backdrop_path: "/show-backdrop.jpg",
      name: "Show",
      next_episode_to_air: {
        air_date: "2026-05-12",
        episode_number: 1,
        name: "Premiere",
        season_number: 3,
      },
      seasons: [{ season_number: 3 }],
      status: "Returning Series",
    })

    await waitFor(() => {
      expect(fetchSeasonEpisodesMock).toHaveBeenCalledWith(2, 3)
      expect(result.current.releases.map((release) => release.uniqueKey)).toEqual([
        "tv-2-s3-e1",
        "movie-1",
      ])
    })

    seasonEpisodesDeferred.resolve([
      {
        air_date: "2026-05-12",
        episode_number: 1,
        id: 101,
        name: "Premiere",
        runtime: null,
      },
      {
        air_date: "2026-05-19",
        episode_number: 2,
        id: 102,
        name: "Episode 2",
        runtime: null,
      },
    ])

    await waitFor(() => {
      expect(result.current.isFetching).toBe(false)
      expect(result.current.releases.map((release) => release.uniqueKey)).toEqual([
        "tv-2-s3-e1",
        "movie-1",
        "tv-2-s3-e2",
      ])
    })
  })

  it("stays in loading state for tv-only results until the first enrichment pass settles", async () => {
    const tvDetailsDeferred = createDeferred<{
      backdrop_path: string | null
      name: string
      next_episode_to_air: null
      seasons: Array<{
        season_number: number
      }>
      status: string
    } | null>()

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

    fetchFullTVDetailsMock.mockReturnValueOnce(tvDetailsDeferred.promise)

    const { result } = renderHook(() => useReleaseCalendar(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(fetchFullTVDetailsMock).toHaveBeenCalledWith(2)
    })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.releases).toEqual([])

    tvDetailsDeferred.resolve({
      backdrop_path: null,
      name: "Show",
      next_episode_to_air: null,
      seasons: [{ season_number: 2 }],
      status: "Ended",
    })

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
      expect(result.current.isFetching).toBe(false)
      expect(result.current.releases).toEqual([])
    })

    expect(fetchSeasonEpisodesMock).not.toHaveBeenCalled()
  })
})
