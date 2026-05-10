import { useForYouRecommendations } from "@/hooks/use-for-you-recommendations"
import type { Rating } from "@/types/rating"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  fetchDiscoverHiddenGems: vi.fn(),
  fetchFullTVDetails: vi.fn(),
  fetchMovieDetails: vi.fn(),
  fetchRecommendations: vi.fn(),
  fetchTrendingWeek: vi.fn(),
  ratings: new Map<string, Rating>(),
  user: {
    uid: "user-1",
    isAnonymous: false,
  },
}))

vi.mock("@/app/actions", () => ({
  fetchDiscoverHiddenGems: (...args: unknown[]) =>
    mocks.fetchDiscoverHiddenGems(...args),
  fetchFullTVDetails: (...args: unknown[]) => mocks.fetchFullTVDetails(...args),
  fetchMovieDetails: (...args: unknown[]) => mocks.fetchMovieDetails(...args),
  fetchRecommendations: (...args: unknown[]) =>
    mocks.fetchRecommendations(...args),
  fetchTrendingWeek: (...args: unknown[]) => mocks.fetchTrendingWeek(...args),
}))

vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({
    user: mocks.user,
    loading: false,
  }),
}))

vi.mock("@/hooks/use-ratings", () => ({
  useRatings: () => ({
    ratings: mocks.ratings,
    loading: false,
  }),
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return {
    Wrapper({ children }: { children: ReactNode }) {
      return (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      )
    },
  }
}

function createRating(overrides: Partial<Rating>): Rating {
  return {
    id: "movie-1",
    mediaId: "1",
    mediaType: "movie",
    rating: 9,
    title: "Alpha",
    posterPath: null,
    releaseDate: "2024-01-01",
    ratedAt: 1,
    ...overrides,
  }
}

function createRecommendedMedia(id: number) {
  return {
    id,
    media_type: "movie" as const,
    adult: false,
    backdrop_path: null,
    poster_path: null,
    title: `Recommended ${id}`,
    overview: "",
    genre_ids: [],
    popularity: 1,
    release_date: "2024-01-01",
    vote_average: 7,
    vote_count: 10,
    original_language: "en",
  }
}

describe("useForYouRecommendations", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.ratings = new Map<string, Rating>()
    mocks.fetchRecommendations.mockResolvedValue([createRecommendedMedia(900)])
    mocks.fetchMovieDetails.mockResolvedValue(null)
    mocks.fetchFullTVDetails.mockResolvedValue(null)
    mocks.fetchDiscoverHiddenGems.mockResolvedValue([])
    mocks.fetchTrendingWeek.mockResolvedValue([])
  })

  it("ignores season ratings and invalid ids while deduping valid recommendation seeds", async () => {
    mocks.ratings = new Map<string, Rating>([
      [
        "season-100-1",
        createRating({
          id: "season-100-1",
          mediaId: "100",
          mediaType: "season",
          title: "Season 1",
          tvShowId: 100,
          seasonNumber: 1,
          tvShowName: "Signal Run",
          ratedAt: 5,
        }),
      ],
      [
        "movie-bad",
        createRating({
          id: "movie-bad",
          mediaId: "not-a-number",
          title: "Broken Seed",
          ratedAt: 4,
        }),
      ],
      [
        "movie-zero",
        createRating({
          id: "movie-zero",
          mediaId: "0",
          title: "Zero Seed",
          ratedAt: 4,
        }),
      ],
      [
        "movie-decimal",
        createRating({
          id: "movie-decimal",
          mediaId: "1.5",
          title: "Decimal Seed",
          ratedAt: 4,
        }),
      ],
      [
        "movie-1",
        createRating({
          id: "movie-1",
          mediaId: "1",
          title: "Alpha",
          ratedAt: 3,
        }),
      ],
      [
        "movie-1-duplicate",
        createRating({
          id: "movie-1-duplicate",
          mediaId: "1",
          title: "Alpha Duplicate",
          ratedAt: 2,
        }),
      ],
    ])

    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => useForYouRecommendations(), {
      wrapper: Wrapper,
    })

    await waitFor(() => {
      expect(result.current.sections).toHaveLength(1)
    })

    expect(result.current.sections[0]?.seed.mediaType).toBe("movie")
    expect(result.current.sections[0]?.seed.id).toBe(1)
    expect(result.current.sections.map((section) => section.seed.mediaType)).toEqual([
      "movie",
    ])
    expect(mocks.fetchRecommendations).toHaveBeenCalledTimes(1)
    expect(mocks.fetchRecommendations).toHaveBeenCalledWith(1, "movie")
    expect(mocks.fetchMovieDetails).not.toHaveBeenCalled()
  })

  it("keeps movie and TV title fetches separate when ids collide", async () => {
    mocks.ratings = new Map<string, Rating>([
      [
        "tv-1",
        createRating({
          id: "tv-1",
          mediaId: "1",
          mediaType: "tv",
          title: "",
          ratedAt: 2,
        }),
      ],
      [
        "movie-1",
        createRating({
          id: "movie-1",
          mediaId: "1",
          mediaType: "movie",
          title: "",
          ratedAt: 1,
        }),
      ],
    ])
    mocks.fetchMovieDetails.mockResolvedValue({ title: "Movie One" })
    mocks.fetchFullTVDetails.mockResolvedValue({ name: "Show One" })

    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => useForYouRecommendations(), {
      wrapper: Wrapper,
    })

    await waitFor(() => {
      expect(result.current.sections).toHaveLength(2)
    })

    expect(
      result.current.sections.map((section) => ({
        mediaType: section.seed.mediaType,
        title: section.seed.title,
      })),
    ).toEqual([
      { mediaType: "tv", title: "Show One" },
      { mediaType: "movie", title: "Movie One" },
    ])
    expect(mocks.fetchMovieDetails).toHaveBeenCalledWith(1)
    expect(mocks.fetchFullTVDetails).toHaveBeenCalledWith(1)
    expect(mocks.fetchRecommendations).toHaveBeenCalledWith(1, "movie")
    expect(mocks.fetchRecommendations).toHaveBeenCalledWith(1, "tv")
  })
})
