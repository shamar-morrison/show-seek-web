import { EpisodeDetailClient } from "@/app/tv/[id]/season/[seasonNumber]/episode/[episodeNumber]/episode-detail-client"
import { render, screen, waitFor } from "@/test/utils"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import type {
  TMDBEpisodeDetails,
  TMDBSeasonDetails,
  TMDBTVDetails,
} from "@/types/tmdb"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getEpisodeRating: vi.fn(),
  getNote: vi.fn(),
  markEpisodeUnwatched: vi.fn(),
  markEpisodeWatched: vi.fn(),
  requireAuth: vi.fn((callback?: () => void | Promise<void>) => callback?.()),
  toggleEpisode: vi.fn(),
  user: {
    uid: "user-1",
    isAnonymous: false,
  },
  useIsEpisodeFavorited: {
    isFavorited: false,
    loading: false,
  },
}))

const originalTimeZone = process.env.TZ

function restoreTimeZone() {
  if (originalTimeZone === undefined) {
    delete process.env.TZ
    return
  }

  process.env.TZ = originalTimeZone
}

vi.mock("@/components/cast-row", () => ({
  CastRow: () => <div>cast-row</div>,
}))

vi.mock("@/components/episode-rating-modal", () => ({
  EpisodeRatingModal: () => <div>episode-rating-modal</div>,
}))

vi.mock("@/components/auth-modal", () => ({
  AuthModal: () => <div>auth-modal</div>,
}))

vi.mock("@/components/notes-modal", () => ({
  NotesModal: ({
    isOpen,
    media,
  }: {
    isOpen: boolean
    media: Record<string, unknown>
  }) =>
    isOpen ? (
      <div data-media={JSON.stringify(media)} data-testid="notes-modal" />
    ) : null,
}))

vi.mock("@/components/photo-lightbox", () => ({
  PhotoLightbox: () => null,
}))

vi.mock("@/components/rate-button", () => ({
  RateButton: ({
    onClick,
    disabled,
  }: {
    onClick: () => void
    disabled?: boolean
  }) => (
    <button disabled={disabled} onClick={onClick} type="button">
      Rate
    </button>
  ),
}))

vi.mock("@/components/trailer-modal", () => ({
  TrailerModal: () => null,
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    disabled,
    onClick,
  }: {
    children?: ReactNode
    disabled?: boolean
    onClick?: () => void
  }) => (
    <button disabled={disabled} onClick={onClick} type="button">
      {children}
    </button>
  ),
}))

vi.mock("@/components/ui/section", () => ({
  Section: ({
    children,
    title,
  }: {
    children?: ReactNode
    title: string
  }) => (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  ),
}))

vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({
    user: mocks.user,
  }),
}))

vi.mock("@/hooks/use-auth-guard", () => ({
  useAuthGuard: () => ({
    requireAuth: mocks.requireAuth,
    modalVisible: false,
    modalMessage: "",
    closeModal: vi.fn(),
  }),
}))

vi.mock("@/hooks/use-episode-tracking-mutations", () => ({
  useEpisodeTrackingMutations: () => ({
    markEpisodeWatched: mocks.markEpisodeWatched,
    markEpisodeUnwatched: mocks.markEpisodeUnwatched,
  }),
}))

vi.mock("@/hooks/use-episode-tracking-show", () => ({
  useEpisodeTrackingShow: () => ({
    tracking: null,
  }),
}))

vi.mock("@/hooks/use-favorite-episodes", () => ({
  useIsEpisodeFavorited: () => mocks.useIsEpisodeFavorited,
  useToggleFavoriteEpisode: () => ({
    toggleEpisode: mocks.toggleEpisode,
    isToggling: false,
  }),
}))

vi.mock("@/hooks/use-notes", () => ({
  useNotes: () => ({
    getNote: mocks.getNote,
    loading: false,
  }),
}))

vi.mock("@/hooks/use-preferences", () => ({
  usePreferences: () => ({
    preferences: {
      blurPlotSpoilers: false,
      markPreviousEpisodesWatched: false,
      showOriginalTitles: false,
    },
  }),
}))

vi.mock("@/hooks/use-ratings", () => ({
  useRatings: () => ({
    getEpisodeRating: mocks.getEpisodeRating,
  }),
}))

function createTvShow(): TMDBTVDetails {
  return {
    id: 100,
    name: "Signal Run",
    original_name: "Signal Run",
    overview: "Show overview",
    poster_path: "/poster.jpg",
    backdrop_path: "/backdrop.jpg",
    first_air_date: "2024-01-01",
    genres: [],
    vote_average: 8.7,
    vote_count: 10,
    original_language: "en",
    adult: false,
    episode_run_time: [42],
    number_of_episodes: 8,
    number_of_seasons: 1,
    seasons: [
      {
        id: 1,
        name: "Season 1",
        overview: "",
        poster_path: "/poster.jpg",
        season_number: 1,
        vote_average: 8,
        air_date: "2024-01-01",
        episode_count: 2,
      },
    ],
    status: "Returning Series",
    created_by: [],
    in_production: true,
    languages: ["en"],
    last_air_date: "2024-01-08",
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

function createEpisode(airDate: string): TMDBEpisodeDetails {
  return {
    id: 200,
    name: "Half Loop",
    overview: "Episode overview",
    season_number: 1,
    episode_number: 2,
    air_date: airDate,
    runtime: 42,
    still_path: "/still.jpg",
    vote_average: 8.2,
    vote_count: 50,
    crew: [],
    guest_stars: [],
    images: { stills: [] },
    videos: { results: [] },
    production_code: "",
    show_id: 100,
  } as TMDBEpisodeDetails
}

function createSeason(episode: TMDBEpisodeDetails): TMDBSeasonDetails {
  return {
    id: 1,
    name: "Season 1",
    overview: "Season overview",
    air_date: "2024-01-01",
    poster_path: "/poster.jpg",
    season_number: 1,
    vote_average: 8,
    episodes: [
      {
        ...episode,
        id: 199,
        episode_number: 1,
        name: "Cold Start",
      },
      episode,
    ],
  } as TMDBSeasonDetails
}

describe("EpisodeDetailClient", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getEpisodeRating.mockReturnValue(null)
    mocks.getNote.mockReturnValue(null)
    mocks.toggleEpisode.mockResolvedValue(undefined)
    mocks.useIsEpisodeFavorited = {
      isFavorited: false,
      loading: false,
    }
  })

  afterEach(() => {
    vi.useRealTimers()
    restoreTimeZone()
  })

  it("toggles favorite episodes using the mobile-compatible payload", async () => {
    const user = userEvent.setup()

    render(
      <EpisodeDetailClient
        tvShow={createTvShow()}
        season={createSeason(createEpisode("2024-01-08"))}
        episode={createEpisode("2024-01-08")}
        tvShowId={100}
      />,
    )

    await user.click(screen.getByRole("button", { name: /favorite/i }))

    await waitFor(() => {
      expect(mocks.toggleEpisode).toHaveBeenCalledWith({
        isFavorited: false,
        episode: {
          id: "100-1-2",
          tvShowId: 100,
          seasonNumber: 1,
          episodeNumber: 2,
          episodeName: "Half Loop",
          showName: "Signal Run",
          posterPath: "/poster.jpg",
        },
      })
    })
  })

  it("opens episode notes with tv show based note ids and metadata", async () => {
    const user = userEvent.setup()

    render(
      <EpisodeDetailClient
        tvShow={createTvShow()}
        season={createSeason(createEpisode("2024-01-08"))}
        episode={createEpisode("2024-01-08")}
        tvShowId={100}
      />,
    )

    await user.click(screen.getByRole("button", { name: /notes/i }))

    const modal = await screen.findByTestId("notes-modal")
    expect(modal).toHaveAttribute(
      "data-media",
      JSON.stringify({
        id: 100,
        show_id: 100,
        season_number: 1,
        episode_number: 2,
        poster_path: "/poster.jpg",
        title: "Half Loop",
      }),
    )
  })

  it("keeps favorite and note actions available for unaired episodes while hiding watched actions", async () => {
    render(
      <EpisodeDetailClient
        tvShow={createTvShow()}
        season={createSeason(createEpisode("2099-01-08"))}
        episode={createEpisode("2099-01-08")}
        tvShowId={100}
      />,
    )

    expect(
      screen.queryByRole("button", { name: /mark watched/i }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /favorite/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /notes/i })).toBeInTheDocument()
  })

  it("renders the exact TMDB air date and does not mark the episode aired early", () => {
    process.env.TZ = "America/Jamaica"
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2024, 2, 26, 23, 30, 0))

    render(
      <EpisodeDetailClient
        tvShow={createTvShow()}
        season={createSeason(createEpisode("2024-03-27"))}
        episode={createEpisode("2024-03-27")}
        tvShowId={100}
      />,
    )

    expect(screen.getAllByText("March 27, 2024")).not.toHaveLength(0)
    expect(screen.getByText("Coming March 27, 2024")).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /mark watched/i }),
    ).not.toBeInTheDocument()
  })
})
