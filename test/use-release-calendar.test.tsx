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

function createMovieListItem(
  id: number,
  releaseDate = `2026-05-${String(id).padStart(2, "0")}`,
) {
  return {
    addedAt: id,
    id,
    media_type: "movie" as const,
    poster_path: `/movie-${id}.jpg`,
    release_date: releaseDate,
    title: `Movie ${id}`,
  }
}

function createTVListItem(id: number) {
  return {
    addedAt: id,
    first_air_date: "2024-01-01",
    id,
    media_type: "tv" as const,
    name: `Show ${id}`,
    poster_path: `/show-${id}.jpg`,
    title: `Show ${id}`,
  }
}

function createMovieRelease(
  id: number,
  releaseDate: string,
): ReleaseCalendarRelease {
  return {
    id,
    mediaType: "movie",
    title: `Movie ${id}`,
    posterPath: `/movie-${id}.jpg`,
    backdropPath: `/movie-${id}-backdrop.jpg`,
    releaseDate,
    sourceLists: ["watchlist"],
    uniqueKey: `movie-${id}`,
  }
}

function createTVRelease(id: number, releaseDate: string): ReleaseCalendarRelease {
  return {
    id,
    mediaType: "tv",
    title: `Show ${id}`,
    posterPath: `/show-${id}.jpg`,
    backdropPath: `/show-${id}-backdrop.jpg`,
    releaseDate,
    nextEpisode: {
      seasonNumber: 1,
      episodeNumber: 1,
      episodeName: `Episode ${id}`,
    },
    sourceLists: ["currently-watching"],
    uniqueKey: `tv-${id}-s1-e1`,
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
          id: 1,
          mediaType: "movie",
          title: "Movie",
          name: undefined,
          posterPath: "/movie.jpg",
          releaseDate: "2026-05-20",
          firstAirDate: undefined,
          sourceList: "watchlist",
        },
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

  it("splits tracked media into 20-item chunks, keeps duplicates together, and merges chunk responses", async () => {
    useListsMock.mockReturnValue({
      error: null,
      lists: [
        {
          id: "favorites",
          items: {
            1: createTVListItem(1),
          },
        },
        {
          id: "currently-watching",
          items: Object.fromEntries(
            Array.from({ length: 21 }, (_, index) => {
              const id = index + 1
              return [id, createTVListItem(id)]
            }),
          ),
        },
      ],
      loading: false,
    })

    fetchReleaseCalendarReleasesMock.mockImplementation(
      async ({
        items,
      }: {
        items: Array<{ id: number; mediaType: "movie" | "tv"; sourceList: string }>
      }) => {
        const uniqueIds = [...new Set(items.map((item) => item.id))]

        if (uniqueIds.includes(21)) {
          return [createTVRelease(21, "2026-05-10")]
        }

        return [createTVRelease(1, "2026-05-12")]
      },
    )

    const { result } = renderHook(() => useReleaseCalendar(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(fetchReleaseCalendarReleasesMock).toHaveBeenCalledTimes(2)
    })

    await waitFor(() => {
      expect(result.current.isRefreshing).toBe(false)
    })

    const firstChunkItems =
      fetchReleaseCalendarReleasesMock.mock.calls[0]?.[0]?.items ?? []
    const secondChunkItems =
      fetchReleaseCalendarReleasesMock.mock.calls[1]?.[0]?.items ?? []

    expect(
      new Set(
        firstChunkItems.map(
          (item: { id: number; mediaType: "movie" | "tv" }) =>
            `${item.mediaType}-${item.id}`,
        ),
      ).size,
    ).toBe(20)
    expect(
      new Set(
        secondChunkItems.map(
          (item: { id: number; mediaType: "movie" | "tv" }) =>
            `${item.mediaType}-${item.id}`,
        ),
      ).size,
    ).toBe(1)
    expect(
      firstChunkItems
        .filter((item: { id: number }) => item.id === 1)
        .map((item: { sourceList: string }) => item.sourceList)
        .sort(),
    ).toEqual(["currently-watching", "favorites"])
    expect(result.current.releases.map((release) => release.uniqueKey)).toEqual([
      "tv-21-s1-e1",
      "tv-1-s1-e1",
    ])
  })

  it("preserves fallback movie releases when one enrichment chunk fails", async () => {
    useListsMock.mockReturnValue({
      error: null,
      lists: [
        {
          id: "watchlist",
          items: Object.fromEntries(
            Array.from({ length: 21 }, (_, index) => {
              const id = index + 1
              return [id, createMovieListItem(id, `2026-05-${String(id).padStart(2, "0")}`)]
            }),
          ),
        },
      ],
      loading: false,
    })

    fetchReleaseCalendarReleasesMock
      .mockRejectedValueOnce(new Error("Chunk failed"))
      .mockResolvedValueOnce([createMovieRelease(21, "2026-05-25")])

    const { result } = renderHook(() => useReleaseCalendar(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(fetchReleaseCalendarReleasesMock).toHaveBeenCalledTimes(2)
    })

    await waitFor(() => {
      expect(result.current.isRefreshing).toBe(false)
    })

    expect(result.current.error).toBeNull()
    expect(result.current.releases).toHaveLength(21)
    expect(
      result.current.releases.find((release) => release.uniqueKey === "movie-1"),
    ).toMatchObject({
      releaseDate: "2026-05-01",
      uniqueKey: "movie-1",
    })
    expect(
      result.current.releases.find((release) => release.uniqueKey === "movie-21"),
    ).toMatchObject({
      releaseDate: "2026-05-25",
      uniqueKey: "movie-21",
    })
  })
})
