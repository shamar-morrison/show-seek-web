import { MarkEntireShowWatchedButton } from "@/components/mark-entire-show-watched-button"
import { render, screen, waitFor } from "@/test/utils"
import type { ReactNode } from "react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  addToList: vi.fn(),
  allowUnreleasedEpisodeWatches: false,
  autoAddToWatching: false,
  fetchSeasonEpisodes: vi.fn(),
  markEntireShowWatched: vi.fn(),
  removeFromList: vi.fn(),
  requireAuthImpl:
    null as null | ((action: () => void | Promise<void>) => void),
  toastError: vi.fn(),
  toastInfo: vi.fn(),
  toastSuccess: vi.fn(),
  tracking: null as { episodes: Record<string, unknown> } | null,
}))

vi.mock("@/app/actions", () => ({
  fetchSeasonEpisodes: (...args: unknown[]) =>
    mocks.fetchSeasonEpisodes(...args),
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

vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({
    user: { uid: "user-1", isAnonymous: false },
    loading: false,
  }),
}))

vi.mock("@/hooks/use-auth-guard", () => ({
  useAuthGuard: () => ({
    requireAuth: (
      action: () => void | Promise<void>,
      _message?: string,
    ) => {
      mocks.requireAuthImpl?.(action)
      return Promise.resolve(action()).catch(() => {})
    },
    modalVisible: false,
    modalMessage: undefined,
    closeModal: vi.fn(),
  }),
}))

vi.mock("@/hooks/use-episode-tracking-mutations", () => ({
  useEpisodeTrackingMutations: () => ({
    markEntireShowWatched: mocks.markEntireShowWatched,
    isMutating: false,
  }),
}))

vi.mock("@/hooks/use-episode-tracking-show", () => ({
  useEpisodeTrackingShow: () => ({
    tracking: mocks.tracking,
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
    success: (...args: unknown[]) => mocks.toastSuccess(...args),
    error: (...args: unknown[]) => mocks.toastError(...args),
    info: (...args: unknown[]) => mocks.toastInfo(...args),
  },
}))

const SEASONS = [
  {
    id: 0,
    name: "Specials",
    season_number: 0,
    episode_count: 1,
  },
  {
    id: 1,
    name: "Season 1",
    season_number: 1,
    episode_count: 2,
  },
  {
    id: 2,
    name: "Season 2",
    season_number: 2,
    episode_count: 1,
  },
] as never

function renderButton() {
  return render(
    <MarkEntireShowWatchedButton
      tvShowId={777}
      tvShowName="Signal Run"
      posterPath="/show.jpg"
      seasons={SEASONS}
      showStats={{ totalEpisodes: 3, avgRuntime: 42 }}
    />,
  )
}

describe("MarkEntireShowWatchedButton", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.allowUnreleasedEpisodeWatches = false
    mocks.autoAddToWatching = false
    mocks.tracking = null
    mocks.requireAuthImpl = null
    mocks.fetchSeasonEpisodes.mockImplementation(
      async (_tvId: number, seasonNumber: number) => {
        if (seasonNumber === 1) {
          return [
            {
              id: 101,
              episode_number: 1,
              name: "Pilot",
              air_date: "2024-01-01",
            },
            {
              id: 102,
              episode_number: 2,
              name: "Future",
              air_date: "2999-01-01",
            },
          ]
        }
        if (seasonNumber === 2) {
          return [
            {
              id: 201,
              episode_number: 1,
              name: "Return",
              air_date: "2024-02-01",
            },
          ]
        }
        return [
          { id: 1, episode_number: 1, name: "Special", air_date: "2024-01-01" },
        ]
      },
    )
    mocks.markEntireShowWatched.mockImplementation(
      async (variables: {
        bulkOptions?: {
          onProgress?: (marked: number, total: number) => void
        }
      }) => {
        variables.bulkOptions?.onProgress?.(2, 2)
      },
    )
    mocks.addToList.mockResolvedValue(false)
  })

  it("marks aired episodes across seasons, skipping specials and unreleased", async () => {
    const user = userEvent.setup()
    renderButton()

    await user.click(screen.getByTestId("seasons-mark-all-button"))

    await waitFor(() => {
      expect(screen.getByText("Mark All Episodes Watched?")).toBeInTheDocument()
    })
    expect(
      screen.getByText(/mark all 2 aired episodes across 2 seasons/i),
    ).toBeInTheDocument()

    await user.click(
      screen.getByRole("button", { name: "Mark All Watched" }),
    )

    await waitFor(() => {
      expect(mocks.markEntireShowWatched).toHaveBeenCalledTimes(1)
    })

    const variables = mocks.markEntireShowWatched.mock.calls[0][0]
    expect(variables.tvShowId).toBe(777)
    // S0 excluded, unaired S1E2 excluded, already-watched none
    expect(variables.episodesToMark).toHaveLength(2)
    expect(
      variables.episodesToMark.every(
        (entry: { seasonNumber: number }) => entry.seasonNumber > 0,
      ),
    ).toBe(true)
    expect(variables.nextEpisode).toBeNull()
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "Marked 2 episodes as watched.",
    )
    expect(mocks.addToList).not.toHaveBeenCalled()
  })

  it("includes unreleased and dateless episodes when the preference is on", async () => {
    const user = userEvent.setup()
    mocks.allowUnreleasedEpisodeWatches = true
    renderButton()

    await user.click(screen.getByTestId("seasons-mark-all-button"))

    await waitFor(() => {
      expect(screen.getByText("Mark All Episodes Watched?")).toBeInTheDocument()
    })
    expect(screen.getByText(/including unreleased/i)).toBeInTheDocument()

    await user.click(
      screen.getByRole("button", { name: "Mark All Watched" }),
    )

    await waitFor(() => {
      expect(mocks.markEntireShowWatched).toHaveBeenCalledTimes(1)
    })

    const variables = mocks.markEntireShowWatched.mock.calls[0][0]
    expect(variables.episodesToMark).toHaveLength(3)
  })

  it("skips already-watched episodes and auto-adds to Watching when enabled", async () => {
    const user = userEvent.setup()
    mocks.autoAddToWatching = true
    mocks.addToList.mockResolvedValue(true)
    mocks.tracking = { episodes: { "1_1": {} } }
    renderButton()

    await user.click(screen.getByTestId("seasons-mark-all-button"))

    await waitFor(() => {
      expect(screen.getByText("Mark All Episodes Watched?")).toBeInTheDocument()
    })

    await user.click(
      screen.getByRole("button", { name: "Mark All Watched" }),
    )

    await waitFor(() => {
      expect(mocks.markEntireShowWatched).toHaveBeenCalledTimes(1)
    })

    const variables = mocks.markEntireShowWatched.mock.calls[0][0]
    expect(variables.episodesToMark).toHaveLength(1)
    expect(variables.episodesToMark[0]).toMatchObject({ seasonNumber: 2 })

    await waitFor(() => {
      expect(mocks.addToList).toHaveBeenCalledWith("currently-watching", {
        id: 777,
        title: "Signal Run",
        poster_path: "/show.jpg",
        media_type: "tv",
        vote_average: undefined,
        first_air_date: undefined,
      })
    })
  })

  it("shows a caught-up toast when nothing is markable", async () => {
    const user = userEvent.setup()
    mocks.tracking = { episodes: { "1_1": {}, "2_1": {} } }
    renderButton()

    await user.click(screen.getByTestId("seasons-mark-all-button"))

    await waitFor(() => {
      expect(mocks.toastInfo).toHaveBeenCalledWith(
        "You're all caught up — nothing left to mark.",
      )
    })
    expect(mocks.markEntireShowWatched).not.toHaveBeenCalled()
  })
})
