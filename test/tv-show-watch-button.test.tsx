import { TVShowWatchButton } from "@/components/tv-show-watch-button"
import { render, screen, waitFor } from "@/test/utils"
import type { ReactNode } from "react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  addToList: vi.fn(),
  allowUnreleasedEpisodeWatches: false,
  autoAddToWatching: false,
  episodesBySeason: new Map<number, Array<Record<string, unknown>>>(),
  markEntireShowUnwatched: vi.fn(),
  markEntireShowWatched: vi.fn(),
  removeFromList: vi.fn(),
  tracking: null as { episodes: Record<string, unknown> } | null,
}))

vi.mock("@/components/auth-modal", () => ({
  AuthModal: () => null,
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

vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({
    children,
    open,
  }: {
    children: ReactNode
    open: boolean
  }) => (open ? <div>{children}</div> : null),
  AlertDialogContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogDescription: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogFooter: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogHeader: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogTitle: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogCancel: ({ children }: { children: ReactNode }) => (
    <button>{children}</button>
  ),
  AlertDialogAction: ({
    children,
    ...rest
  }: {
    children: ReactNode
    [key: string]: unknown
  }) => <button {...rest}>{children}</button>,
}))

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ render }: { render: ReactNode }) => <>{render}</>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    onClick,
  }: {
    children: ReactNode
    onClick?: () => void
  }) => <button onClick={onClick}>{children}</button>,
}))

vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({
    user: { uid: "user-1", isAnonymous: false },
    loading: false,
  }),
}))

vi.mock("@/hooks/use-auth-guard", () => ({
  useAuthGuard: () => ({
    requireAuth: (action: () => void | Promise<void>) => {
      void action()
    },
    modalVisible: false,
    modalMessage: undefined,
    closeModal: vi.fn(),
    onAuthSuccess: vi.fn(),
  }),
}))

vi.mock("@/hooks/use-all-season-episodes", () => ({
  useAllSeasonEpisodes: () => ({
    episodesBySeason: mocks.episodesBySeason,
    isLoading: false,
    hasFetchedAll: true,
  }),
}))

vi.mock("@/hooks/use-episode-tracking-mutations", () => ({
  useEpisodeTrackingMutations: () => ({
    markEntireShowWatched: mocks.markEntireShowWatched,
    markEntireShowUnwatched: mocks.markEntireShowUnwatched,
    isMutating: false,
  }),
}))

vi.mock("@/hooks/use-episode-tracking-show", () => ({
  useEpisodeTrackingShow: () => ({
    tracking: mocks.tracking,
    loading: false,
  }),
}))

vi.mock("@/hooks/use-list-mutations", () => ({
  useListMutations: () => ({
    addToList: mocks.addToList,
    removeFromList: mocks.removeFromList,
  }),
}))

vi.mock("@/hooks/use-preferences", () => ({
  usePreferences: () => ({
    preferences: {
      allowUnreleasedEpisodeWatches: mocks.allowUnreleasedEpisodeWatches,
      autoAddToWatching: mocks.autoAddToWatching,
    },
  }),
}))

vi.mock("@/lib/actionable-toast", () => ({
  showActionableSuccessToast: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

const SEASONS = [
  { id: 0, name: "Specials", season_number: 0, episode_count: 1 },
  { id: 1, name: "Season 1", season_number: 1, episode_count: 2 },
  { id: 2, name: "Season 2", season_number: 2, episode_count: 2 },
] as never

function ep(
  episodeNumber: number,
  airDate: string | null,
  seasonNumber = 1,
) {
  return {
    id: seasonNumber * 100 + episodeNumber,
    episode_number: episodeNumber,
    name: `Season ${seasonNumber} Episode ${episodeNumber}`,
    air_date: airDate,
  }
}

function setEpisodes(
  bySeason: Record<number, Array<Record<string, unknown>>>,
) {
  mocks.episodesBySeason = new Map(
    Object.entries(bySeason).map(([season, episodes]) => [
      Number(season),
      episodes,
    ]),
  )
}

function renderButton() {
  return render(
    <TVShowWatchButton
      tvShowId={777}
      tvShowName="Signal Run"
      posterPath="/show.jpg"
      seasons={SEASONS}
      showStats={{ totalEpisodes: 4, avgRuntime: 42 }}
    />,
  )
}

describe("TVShowWatchButton", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.allowUnreleasedEpisodeWatches = false
    mocks.autoAddToWatching = false
    mocks.tracking = null
    mocks.episodesBySeason = new Map()
    mocks.markEntireShowWatched.mockResolvedValue(undefined)
    mocks.markEntireShowUnwatched.mockResolvedValue(undefined)
    mocks.addToList.mockResolvedValue(false)
  })

  it("marks only aired episodes across seasons after confirming", async () => {
    const user = userEvent.setup()
    setEpisodes({
      1: [ep(1, "2024-01-01"), ep(2, "2999-01-01")],
      2: [ep(1, "2024-02-01", 2), ep(2, null, 2)],
    })
    renderButton()

    expect(screen.getByTestId("tv-show-watch-button")).toHaveTextContent(
      "Mark as Watched",
    )

    await user.click(screen.getByTestId("tv-show-watch-button"))

    await waitFor(() => {
      expect(
        screen.getByText("Mark All Episodes Watched?"),
      ).toBeInTheDocument()
    })
    expect(
      screen.getByText(/mark all 2 aired episodes across 2 seasons/i),
    ).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Mark All Watched" }))

    await waitFor(() => {
      expect(mocks.markEntireShowWatched).toHaveBeenCalledTimes(1)
    })
    const variables = mocks.markEntireShowWatched.mock.calls[0][0]
    expect(variables.nextEpisode).toBeNull()
    expect(variables.episodesToMark).toHaveLength(2)
    expect(
      variables.episodesToMark.every(
        (entry: { seasonNumber: number }) => entry.seasonNumber > 0,
      ),
    ).toBe(true)
  })

  it("includes unreleased but excludes dateless episodes when the preference is on", async () => {
    const user = userEvent.setup()
    mocks.allowUnreleasedEpisodeWatches = true
    setEpisodes({
      1: [ep(1, "2024-01-01"), ep(2, "2999-01-01")],
      2: [ep(1, null, 2)],
    })
    renderButton()

    await user.click(screen.getByTestId("tv-show-watch-button"))

    await waitFor(() => {
      expect(screen.getByText(/including unreleased/i)).toBeInTheDocument()
    })
    await user.click(screen.getByRole("button", { name: "Mark All Watched" }))

    await waitFor(() => {
      expect(mocks.markEntireShowWatched).toHaveBeenCalledTimes(1)
    })
    const variables = mocks.markEntireShowWatched.mock.calls[0][0]
    // S1E1 aired + S1E2 future; S2E1 has no air date and is excluded.
    expect(variables.episodesToMark).toHaveLength(2)
    expect(
      variables.episodesToMark.every(
        (entry: { episode: { air_date: string | null } }) =>
          !!entry.episode.air_date,
      ),
    ).toBe(true)
  })

  it("shows Mark as Unwatched and unmarks tracked episodes after confirming", async () => {
    const user = userEvent.setup()
    mocks.tracking = { episodes: { "1_1": {}, "2_1": {} } }
    setEpisodes({
      1: [ep(1, "2024-01-01"), ep(2, "2999-01-01")],
      2: [ep(1, "2024-02-01", 2)],
    })
    renderButton()

    expect(screen.getByTestId("tv-show-watch-button")).toHaveTextContent(
      "Mark as Unwatched",
    )

    await user.click(screen.getByTestId("tv-show-watch-button"))
    await waitFor(() => {
      expect(screen.getByText("Unmark All Episodes?")).toBeInTheDocument()
    })
    await user.click(screen.getByRole("button", { name: "Unmark All" }))

    await waitFor(() => {
      expect(mocks.markEntireShowUnwatched).toHaveBeenCalledTimes(1)
    })
    const variables = mocks.markEntireShowUnwatched.mock.calls[0][0]
    expect(variables.episodesToUnmark).toEqual([
      { seasonNumber: 1, episodeNumber: 1 },
      { seasonNumber: 2, episodeNumber: 1 },
    ])
  })

  it("clears every tracked regular-season episode via the dropdown", async () => {
    const user = userEvent.setup()
    mocks.tracking = {
      episodes: { "1_1": {}, "2_1": {}, "2_2": {} },
    }
    setEpisodes({
      1: [ep(1, "2024-01-01")],
      2: [ep(1, "2024-02-01", 2)],
    })
    renderButton()

    await user.click(
      screen.getByRole("button", { name: "Watch history actions" }),
    )
    await user.click(screen.getByRole("button", { name: "Clear watch history" }))

    await waitFor(() => {
      expect(screen.getByText("Clear all watched episodes?")).toBeInTheDocument()
    })
    expect(
      screen.getByText(/unmark all 3 watched episodes across all seasons/i),
    ).toBeInTheDocument()

    await user.click(screen.getByTestId("tv-show-clear-history-confirm"))

    await waitFor(() => {
      expect(mocks.markEntireShowUnwatched).toHaveBeenCalledTimes(1)
    })
    const variables = mocks.markEntireShowUnwatched.mock.calls[0][0]
    expect(variables.episodesToUnmark).toEqual([
      { seasonNumber: 1, episodeNumber: 1 },
      { seasonNumber: 2, episodeNumber: 1 },
      { seasonNumber: 2, episodeNumber: 2 },
    ])
  })

  it("keeps the button and unmark reachable when tracked episodes are no longer markable", async () => {
    const user = userEvent.setup()
    // Tracked while unreleased watches were allowed; the preference is now off
    // and every episode has a null air date, so none are currently markable.
    mocks.tracking = { episodes: { "1_1": {}, "2_1": {} } }
    setEpisodes({
      1: [ep(1, null)],
      2: [ep(1, null, 2)],
    })
    renderButton()

    const button = screen.getByTestId("tv-show-watch-button")
    expect(button).toHaveTextContent("Mark as Unwatched")
    expect(button).not.toHaveTextContent("Episodes Watched")
    // Zero markable but tracked > 0 must still render a full fill.
    expect(screen.getByTestId("tv-show-watch-fill").style.width).toBe("100%")
    expect(
      screen.getByRole("button", { name: "Watch history actions" }),
    ).toBeInTheDocument()

    await user.click(button)
    await waitFor(() => {
      expect(screen.getByText("Unmark All Episodes?")).toBeInTheDocument()
    })
    await user.click(screen.getByRole("button", { name: "Unmark All" }))

    await waitFor(() => {
      expect(mocks.markEntireShowUnwatched).toHaveBeenCalledTimes(1)
    })
    expect(
      mocks.markEntireShowUnwatched.mock.calls[0][0].episodesToUnmark,
    ).toEqual([
      { seasonNumber: 1, episodeNumber: 1 },
      { seasonNumber: 2, episodeNumber: 1 },
    ])
  })

  it("renders a progress fill matching the watched ratio for a partial state", () => {
    setEpisodes({
      1: [ep(1, "2024-01-01"), ep(2, "2024-01-01")],
      2: [ep(1, "2024-02-01", 2), ep(2, "2024-02-01", 2)],
    })
    mocks.tracking = { episodes: { "1_1": {}, "2_1": {} } }
    renderButton()

    expect(screen.getByTestId("tv-show-watch-button")).toHaveTextContent(
      "2/4 Episodes Watched",
    )
    expect(screen.getByTestId("tv-show-watch-fill").style.width).toBe("50%")
  })

  it("renders a full progress fill when fully watched", () => {
    setEpisodes({
      1: [ep(1, "2024-01-01"), ep(2, "2024-01-01")],
      2: [ep(1, "2024-02-01", 2)],
    })
    mocks.tracking = {
      episodes: { "1_1": {}, "1_2": {}, "2_1": {} },
    }
    renderButton()

    expect(screen.getByTestId("tv-show-watch-button")).toHaveTextContent(
      "Mark as Unwatched",
    )
    expect(screen.getByTestId("tv-show-watch-fill").style.width).toBe("100%")
  })

  it("renders no progress fill when nothing is watched", () => {
    setEpisodes({ 1: [ep(1, "2024-01-01")] })
    renderButton()

    expect(
      screen.queryByTestId("tv-show-watch-fill"),
    ).not.toBeInTheDocument()
  })

  it("renders nothing when there is nothing markable and nothing tracked", () => {
    setEpisodes({
      1: [ep(1, "2999-01-01")],
    })
    renderButton()

    expect(
      screen.queryByTestId("tv-show-watch-button"),
    ).not.toBeInTheDocument()
  })
})
