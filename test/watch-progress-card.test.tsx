import { WatchProgressCard } from "@/components/watch-progress-card"
import { render, screen } from "@/test/utils"
import { act, fireEvent } from "@testing-library/react"
import type { WatchProgressItem } from "@/hooks/use-episode-tracking"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  clearAllEpisodes: vi.fn(),
  setHiddenFromProgress: vi.fn(),
  resolvePosterPath: vi.fn(
    (_mediaType: "tv", _mediaId: number, fallbackPosterPath: string | null) =>
      fallbackPosterPath,
  ),
}))

vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTrigger: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogCancel: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  AlertDialogAction: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}))

vi.mock("@/hooks/use-episode-tracking-mutations", () => ({
  useEpisodeTrackingMutations: () => ({
    clearAllEpisodes: mocks.clearAllEpisodes,
    setHiddenFromProgress: mocks.setHiddenFromProgress,
  }),
}))

vi.mock("@/hooks/use-poster-overrides", () => ({
  usePosterOverrides: () => ({
    resolvePosterPath: mocks.resolvePosterPath,
  }),
}))

function createProgress(overrides: Partial<WatchProgressItem> = {}): WatchProgressItem {
  return {
    tvShowId: 101,
    tvShowName: "Severance",
    posterPath: "/default-show-poster.jpg",
    backdropPath: null,
    lastUpdated: Date.now(),
    percentage: 50,
    timeRemaining: 120,
    watchedCount: 5,
    totalEpisodes: 10,
    avgRuntime: 48,
    lastWatchedEpisode: {
      season: 1,
      episode: 5,
      title: "The Grim Barbarity of Optics and Design",
    },
    nextEpisode: {
      season: 1,
      episode: 6,
      title: "Hide and Seek",
      airDate: null,
    },
    isHidden: false,
    ...overrides,
  }
}

describe("WatchProgressCard", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.resolvePosterPath.mockImplementation(
      (_mediaType: "tv", _mediaId: number, fallbackPosterPath: string | null) =>
        fallbackPosterPath,
    )
  })

  it("renders the resolved tv poster override for watch progress items", () => {
    mocks.resolvePosterPath.mockReturnValue("/custom-show-poster.jpg")

    render(<WatchProgressCard progress={createProgress()} />)

    expect(screen.getByAltText("Severance")).toHaveAttribute(
      "src",
      "https://image.tmdb.org/t/p/w185/custom-show-poster.jpg",
    )
  })

  it("calls setHiddenFromProgress with hidden: true when clicking the hide button", async () => {
    render(<WatchProgressCard progress={createProgress({ isHidden: false })} />)

    const hideButton = screen.getByRole("button", {
      name: "Hide Severance from watch progress",
    })
    await act(async () => {
      fireEvent.click(hideButton)
    })

    expect(mocks.setHiddenFromProgress).toHaveBeenCalledWith({
      tvShowId: 101,
      hidden: true,
    })
  })

  it("calls setHiddenFromProgress with hidden: false when clicking restore in hidden view", async () => {
    render(
      <WatchProgressCard
        progress={createProgress({ isHidden: true })}
        isHiddenView={true}
      />,
    )

    const restoreButton = screen.getByRole("button", {
      name: "Restore Severance to watch progress",
    })
    await act(async () => {
      fireEvent.click(restoreButton)
    })

    expect(mocks.setHiddenFromProgress).toHaveBeenCalledWith({
      tvShowId: 101,
      hidden: false,
    })
  })

  it("keeps destructive delete confirmation working as-is", async () => {
    render(<WatchProgressCard progress={createProgress()} />)

    const deleteTrigger = screen.getByRole("button", {
      name: "Remove Severance from watch progress",
    })
    await act(async () => {
      fireEvent.click(deleteTrigger)
    })

    const confirmAction = screen.getByRole("button", { name: "Remove" })
    await act(async () => {
      fireEvent.click(confirmAction)
    })

    expect(mocks.clearAllEpisodes).toHaveBeenCalledWith({
      tvShowId: 101,
    })
  })
})
