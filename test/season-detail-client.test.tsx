import { SeasonDetailClient } from "@/app/tv/[id]/season/[seasonNumber]/season-detail-client"
import { render, screen } from "@/test/utils"
import type { ReactNode } from "react"
import type { TMDBSeasonDetails, TMDBTVDetails } from "@/types/tmdb"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getSeasonRating: vi.fn(),
  loading: false,
  markAllEpisodesUnwatched: vi.fn(),
  markAllEpisodesWatched: vi.fn(),
  tracking: null as { episodes: Record<string, unknown> } | null,
  user: {
    uid: "user-1",
    isAnonymous: false,
  } as { uid: string; isAnonymous: boolean } | null,
}))

vi.mock("@/components/auth-modal", () => ({
  AuthModal: ({
    isOpen,
    message,
  }: {
    isOpen: boolean
    message?: string
  }) => (isOpen ? <div>{message}</div> : null),
}))

vi.mock("@/components/episode-card", () => ({
  EpisodeCard: () => <div>episode-card</div>,
}))

vi.mock("@/components/page-container", () => ({
  PageContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/season-rating-modal", () => ({
  SeasonRatingModal: ({
    isOpen,
  }: {
    isOpen: boolean
  }) => (isOpen ? <div>season-rating-modal</div> : null),
}))

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({
    children,
    open,
  }: {
    children: ReactNode
    open: boolean
  }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({
    user: mocks.user,
    loading: false,
  }),
}))

vi.mock("@/hooks/use-episode-tracking-mutations", () => ({
  useEpisodeTrackingMutations: () => ({
    markAllEpisodesWatched: mocks.markAllEpisodesWatched,
    markAllEpisodesUnwatched: mocks.markAllEpisodesUnwatched,
  }),
}))

vi.mock("@/hooks/use-episode-tracking-show", () => ({
  useEpisodeTrackingShow: () => ({
    tracking: mocks.tracking,
  }),
}))

vi.mock("@/hooks/use-poster-overrides", () => ({
  usePosterOverrides: () => ({
    resolvePosterPath: (
      _mediaType: "movie" | "tv",
      _mediaId: number,
      posterPath: string | null,
    ) => posterPath,
  }),
}))

vi.mock("@/hooks/use-preferences", () => ({
  usePreferences: () => ({
    preferences: {
      blurPlotSpoilers: false,
      showOriginalTitles: false,
    },
  }),
}))

vi.mock("@/hooks/use-ratings", () => ({
  useRatings: () => ({
    getSeasonRating: mocks.getSeasonRating,
    loading: mocks.loading,
  }),
}))

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}))

function createTvShow(): TMDBTVDetails {
  return {
    id: 777,
    name: "Signal Run",
    original_name: "Signal Run",
    overview: "TV overview",
    poster_path: "/show.jpg",
    backdrop_path: null,
    first_air_date: "2024-01-01",
    genres: [],
    vote_average: 8.5,
    vote_count: 10,
    original_language: "en",
    adult: false,
    episode_run_time: [42],
    number_of_episodes: 8,
    number_of_seasons: 2,
    seasons: [
      {
        id: 10,
        name: "Season 2",
        overview: "Season overview",
        poster_path: "/season.jpg",
        season_number: 2,
        vote_average: 8.4,
        air_date: "2025-01-01",
        episode_count: 2,
      },
    ],
    status: "Returning Series",
    created_by: [],
    in_production: true,
    languages: ["en"],
    last_air_date: "2025-01-08",
    last_episode_to_air: null,
    networks: [],
    origin_country: ["US"],
    production_companies: [],
    production_countries: [],
    spoken_languages: [],
    tagline: "",
    type: "Scripted",
    homepage: "",
    popularity: 1,
  } as unknown as TMDBTVDetails
}

function createSeason(): TMDBSeasonDetails {
  return {
    id: 10,
    season_number: 2,
    name: "Season 2",
    overview: "Season overview",
    poster_path: "/season.jpg",
    air_date: "2025-01-01",
    vote_average: 8.4,
    episodes: [
      {
        id: 1001,
        episode_number: 1,
        name: "First Signal",
        overview: "",
        air_date: "2025-01-01",
        runtime: 42,
        still_path: null,
        vote_average: 8,
        vote_count: 10,
        season_number: 2,
      },
    ],
  }
}

describe("SeasonDetailClient", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.user = {
      uid: "user-1",
      isAnonymous: false,
    }
    mocks.getSeasonRating.mockReturnValue(null)
  })

  it("shows the existing season rating and opens the season modal for authenticated users", async () => {
    const user = userEvent.setup()

    mocks.getSeasonRating.mockReturnValue({
      id: "season-777-2",
      mediaId: "777",
      mediaType: "season",
      rating: 8.5,
      title: "Season 2",
      posterPath: "/season.jpg",
      releaseDate: "2025-01-01",
      ratedAt: 1,
      tvShowId: 777,
      seasonNumber: 2,
      tvShowName: "Signal Run",
    })

    render(
      <SeasonDetailClient
        tvShow={createTvShow()}
        season={createSeason()}
        tvShowId={777}
      />,
    )

    expect(screen.getByRole("button", { name: /8.5\/10/i })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /8.5\/10/i }))

    expect(screen.getByText("season-rating-modal")).toBeInTheDocument()
  })

  it("prompts unauthenticated users to sign in before rating seasons", async () => {
    const user = userEvent.setup()

    mocks.user = null

    render(
      <SeasonDetailClient
        tvShow={createTvShow()}
        season={createSeason()}
        tvShowId={777}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Rate" }))

    expect(screen.getByText("Sign in to rate seasons")).toBeInTheDocument()
  })
})
