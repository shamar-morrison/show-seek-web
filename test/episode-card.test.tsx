import { EpisodeCard } from "@/components/episode-card"
import { render, screen, waitFor } from "@/test/utils"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import type { TMDBSeasonEpisode } from "@/types/tmdb"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  addToList: vi.fn(),
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

vi.mock("@/hooks/use-favorite-episodes", () => ({
  useIsEpisodeFavorited: () => mocks.useIsEpisodeFavorited,
  useToggleFavoriteEpisode: () => ({
    toggleEpisode: mocks.toggleEpisode,
    isToggling: false,
  }),
}))

vi.mock("@/hooks/use-list-mutations", () => ({
  useListMutations: () => ({
    addToList: mocks.addToList,
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
      autoAddToWatching: false,
      blurPlotSpoilers: false,
      markPreviousEpisodesWatched: false,
    },
  }),
}))

vi.mock("@/hooks/use-ratings", () => ({
  useRatings: () => ({
    getEpisodeRating: mocks.getEpisodeRating,
  }),
}))

function createEpisode(airDate: string): TMDBSeasonEpisode {
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
  } as TMDBSeasonEpisode
}

function renderEpisodeCard(episode: TMDBSeasonEpisode) {
  return render(
    <EpisodeCard
      episode={episode}
      tvShowId={100}
      tvShowName="Signal Run"
      tvShowPosterPath="/poster.jpg"
      isWatched={false}
      allSeasonEpisodes={[episode]}
    />,
  )
}

describe("EpisodeCard", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.addToList.mockResolvedValue(false)
    mocks.getEpisodeRating.mockReturnValue(null)
    mocks.getNote.mockReturnValue(null)
    mocks.toggleEpisode.mockResolvedValue(undefined)
    mocks.useIsEpisodeFavorited = {
      isFavorited: false,
      loading: false,
    }
  })

  it("toggles favorite episodes using the mobile-compatible payload", async () => {
    const user = userEvent.setup()

    renderEpisodeCard(createEpisode("2024-01-08"))

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

  it("opens episode notes with tv show based metadata instead of the episode id", async () => {
    const user = userEvent.setup()

    renderEpisodeCard(createEpisode("2024-01-08"))

    await user.click(screen.getByRole("button", { name: /add episode note/i }))

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

  it("shows View Note when an episode note already exists", () => {
    mocks.getNote.mockReturnValue({ content: "Existing note" })

    renderEpisodeCard(createEpisode("2024-01-08"))

    expect(screen.getByRole("button", { name: /view episode note/i })).toBeInTheDocument()
    expect(screen.getByText("View Note")).toBeInTheDocument()
  })

  it("keeps favorite and notes actions available for unaired episodes while hiding watched and rate actions", () => {
    renderEpisodeCard(createEpisode("2099-01-08"))

    expect(screen.getByRole("button", { name: /favorite/i })).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /add episode note/i }),
    ).toBeInTheDocument()
    expect(screen.queryByText("Mark Watched")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Rate episode" }),
    ).not.toBeInTheDocument()
  })
})
