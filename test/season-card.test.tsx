import { SeasonCard } from "@/components/season-card"
import { render, screen, waitFor } from "@/test/utils"
import type { TVShowEpisodeTracking } from "@/types/episode-tracking"
import type { TMDBSeason } from "@/types/tmdb"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  allowUnreleasedEpisodeWatches: false,
  fetchSeasonEpisodes: vi.fn(),
  getSeasonRating: vi.fn(),
  markAllEpisodesUnwatched: vi.fn(),
  markAllEpisodesWatched: vi.fn(),
  requireAuthCalls: [] as Array<() => void | Promise<void>>,
  toastError: vi.fn(),
  toastInfo: vi.fn(),
  trackingKeys: [] as string[],
  user: { uid: "user-1", isAnonymous: false } as {
    uid: string
    isAnonymous: boolean
  } | null,
}))

vi.mock("@/app/actions", () => ({
  fetchSeasonEpisodes: (...args: unknown[]) =>
    mocks.fetchSeasonEpisodes(...args),
}))

vi.mock("@/components/auth-modal", () => ({
  AuthModal: () => null,
}))

vi.mock("@/components/season-rating-modal", () => ({
  SeasonRatingModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="season-rating-modal" /> : null,
}))

vi.mock("@/components/media-card-dropdown-menu", () => ({
  MediaCardDropdownMenu: ({
    items,
  }: {
    items: Array<{
      id: string
      label: string
      disabled?: boolean
      onClick?: () => void
    }>
  }) => (
    <div data-testid="season-dropdown">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          disabled={item.disabled}
          onClick={item.onClick}
        >
          {item.label}
        </button>
      ))}
    </div>
  ),
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    ...rest
  }: {
    children: ReactNode
    onClick?: () => void
    disabled?: boolean
    [key: string]: unknown
  }) => (
    <button onClick={onClick} disabled={disabled} {...rest}>
      {children}
    </button>
  ),
}))

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({
    children,
    open,
  }: {
    children: ReactNode
    open: boolean
  }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogDescription: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
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

vi.mock("@/hooks/use-auth-guard", () => ({
  useAuthGuard: () => ({
    requireAuth: (action: () => void | Promise<void>) => {
      mocks.requireAuthCalls.push(action)
      if (!mocks.user) return Promise.resolve()
      return Promise.resolve(action()).catch(() => {})
    },
    modalVisible: false,
    modalMessage: undefined,
    closeModal: vi.fn(),
    onAuthSuccess: vi.fn(),
  }),
}))

vi.mock("@/hooks/use-episode-tracking-mutations", () => ({
  useEpisodeTrackingMutations: () => ({
    markAllEpisodesWatched: mocks.markAllEpisodesWatched,
    markAllEpisodesUnwatched: mocks.markAllEpisodesUnwatched,
    isMutating: false,
  }),
}))

vi.mock("@/hooks/use-preferences", () => ({
  usePreferences: () => ({
    preferences: {
      allowUnreleasedEpisodeWatches: mocks.allowUnreleasedEpisodeWatches,
    },
  }),
}))

vi.mock("@/hooks/use-ratings", () => ({
  useRatings: () => ({
    getSeasonRating: mocks.getSeasonRating,
  }),
}))

vi.mock("sonner", () => ({
  toast: {
    info: (...args: unknown[]) => mocks.toastInfo(...args),
    error: (...args: unknown[]) => mocks.toastError(...args),
  },
}))

const SEASON: TMDBSeason = {
  air_date: "2020-01-01",
  episode_count: 3,
  id: 101,
  name: "Season 1",
  overview: "",
  poster_path: "/s1.jpg",
  season_number: 1,
  vote_average: 8,
}

const EPISODES = [
  { id: 11, episode_number: 1, name: "Pilot", air_date: "2020-01-01" },
  { id: 12, episode_number: 2, name: "Second", air_date: "2020-01-08" },
  { id: 13, episode_number: 3, name: "Future", air_date: "2099-01-01" },
]

function trackingMap(): Map<string, TVShowEpisodeTracking> {
  const episodes: Record<string, TVShowEpisodeTracking["episodes"][string]> =
    {}
  for (const key of mocks.trackingKeys) {
    const [, episodeNumber] = key.split("_").map(Number)
    episodes[key] = {
      episodeId: episodeNumber,
      tvShowId: 99,
      seasonNumber: 1,
      episodeNumber,
      watchedAt: Date.now(),
      episodeName: `Episode ${episodeNumber}`,
      episodeAirDate: "2020-01-01",
    }
  }
  return new Map([
    [
      "99",
      {
        episodes,
        metadata: {
          tvShowName: "Show",
          posterPath: null,
          lastUpdated: Date.now(),
        },
      },
    ],
  ])
}

function renderCard(overrides?: {
  watchedCount?: number
  totalCount?: number
}) {
  return render(
    <SeasonCard
      tvShowId={99}
      tvShowName="Show"
      posterPath={null}
      season={SEASON}
      watchedCount={overrides?.watchedCount ?? mocks.trackingKeys.length}
      totalCount={overrides?.totalCount ?? 3}
      trackingLoading={false}
      tracking={trackingMap()}
    />,
  )
}

beforeEach(() => {
  mocks.allowUnreleasedEpisodeWatches = false
  mocks.fetchSeasonEpisodes.mockReset().mockResolvedValue(EPISODES)
  mocks.getSeasonRating.mockReset().mockReturnValue(null)
  mocks.markAllEpisodesUnwatched.mockReset()
  mocks.markAllEpisodesWatched.mockReset()
  mocks.requireAuthCalls = []
  mocks.toastError.mockReset()
  mocks.toastInfo.mockReset()
  mocks.trackingKeys = ["1_1"]
  mocks.user = { uid: "user-1", isAnonymous: false }
})

describe("SeasonCard", () => {
  it("renders season info, progress, and quick actions", () => {
    renderCard()

    expect(screen.getByText("Season 1")).toBeInTheDocument()
    expect(screen.getByText("1/3")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Mark Season Watched" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Rate Season" }),
    ).toBeInTheDocument()
  })

  it("marks only aired, unwatched episodes after confirming", async () => {
    const user = userEvent.setup()
    renderCard()

    await user.click(
      screen.getByRole("button", { name: "Mark Season Watched" }),
    )

    // Confirm dialog mirrors season details copy for aired-only marks.
    expect(
      screen.getByText("Mark All Episodes Watched?"),
    ).toBeInTheDocument()
    await user.click(
      screen.getByRole("button", { name: "Mark All Watched" }),
    )

    await waitFor(() => {
      expect(mocks.markAllEpisodesWatched).toHaveBeenCalledTimes(1)
    })
    expect(mocks.markAllEpisodesWatched).toHaveBeenCalledWith(
      expect.objectContaining({
        tvShowId: 99,
        seasonNumber: 1,
        // Episode 1 already watched, episode 3 unaired: only episode 2.
        episodes: [
          {
            id: 12,
            episode_number: 2,
            name: "Second",
            air_date: "2020-01-08",
          },
        ],
      }),
    )
  })

  it("offers unmark when the season is fully watched", async () => {
    const user = userEvent.setup()
    mocks.trackingKeys = ["1_1", "1_2"]
    renderCard({ watchedCount: 3, totalCount: 3 })

    await user.click(screen.getByRole("button", { name: "Unmark Season" }))
    expect(screen.getByText("Unmark All Episodes?")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Unmark All" }))

    await waitFor(() => {
      expect(mocks.markAllEpisodesUnwatched).toHaveBeenCalledTimes(1)
    })
    expect(mocks.markAllEpisodesUnwatched).toHaveBeenCalledWith({
      tvShowId: 99,
      seasonNumber: 1,
      episodeNumbers: [1, 2],
    })
  })

  it("shows the existing rating and opens the rating modal", async () => {
    const user = userEvent.setup()
    mocks.getSeasonRating.mockReturnValue({ rating: 8 })
    renderCard()

    await user.click(screen.getByRole("button", { name: "8/10" }))

    expect(screen.getByTestId("season-rating-modal")).toBeInTheDocument()
  })

  it("does not load episodes for guests", async () => {
    const user = userEvent.setup()
    mocks.user = null
    // Guest guard swallows the action instead of running it.
    renderCard()

    await user.click(
      screen.getByRole("button", { name: "Mark Season Watched" }),
    )

    expect(mocks.fetchSeasonEpisodes).not.toHaveBeenCalled()
    expect(
      screen.queryByText("Mark All Episodes Watched?"),
    ).not.toBeInTheDocument()
  })
})
