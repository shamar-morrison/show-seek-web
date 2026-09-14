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
      kind: "unwatched",
      season: 1,
      episode: 6,
      title: "Hide and Seek",
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

  it("links to season detail and shows time remaining when next episode is unwatched", () => {
    render(
      <WatchProgressCard
        progress={createProgress({
          timeRemaining: 120,
          nextEpisode: {
            kind: "unwatched",
            season: 1,
            episode: 6,
            title: "Hide and Seek",
          },
        })}
      />,
    )

    const links = screen.getAllByRole("link", { name: "Severance" })
    expect(links.length).toBeGreaterThanOrEqual(1)
    links.forEach((link) => expect(link).toHaveAttribute("href", "/tv/101/season/1"))
    expect(screen.getByText("Next:")).toBeInTheDocument()
    expect(screen.getByText("S1E6: Hide and Seek")).toBeInTheDocument()
    expect(screen.getByText("2h left")).toBeInTheDocument()
  })

  it("links to season detail and hides time remaining when next episode is upcoming with season > 0", () => {
    render(
      <WatchProgressCard
        progress={createProgress({
          timeRemaining: 90,
          nextEpisode: {
            kind: "upcoming",
            season: 2,
            episode: 1,
            title: "Episode 1",
          },
        })}
      />,
    )

    const links = screen.getAllByRole("link", { name: "Severance" })
    expect(links.length).toBeGreaterThanOrEqual(1)
    links.forEach((link) => expect(link).toHaveAttribute("href", "/tv/101/season/2"))
    expect(screen.getByText("Next:")).toBeInTheDocument()
    expect(screen.getByText("S2E1: Episode 1")).toBeInTheDocument()
    expect(screen.queryByText(/left/)).not.toBeInTheDocument()
  })

  it("links to show detail and shows 'Caught up!' when next episode is upcoming with season 0", () => {
    render(
      <WatchProgressCard
        progress={createProgress({
          timeRemaining: 0,
          nextEpisode: {
            kind: "upcoming",
            season: 0,
            episode: 0,
            title: "",
          },
        })}
      />,
    )

    const links = screen.getAllByRole("link", { name: "Severance" })
    expect(links.length).toBeGreaterThanOrEqual(1)
    links.forEach((link) => expect(link).toHaveAttribute("href", "/tv/101"))
    expect(screen.getByText("Next:")).toBeInTheDocument()
    expect(screen.getByText("Caught up!")).toBeInTheDocument()
    expect(screen.queryByText(/left/)).not.toBeInTheDocument()
  })

  it("links to show detail and shows 'Series complete' without 'Next:' label when complete", () => {
    render(
      <WatchProgressCard
        progress={createProgress({
          percentage: 100,
          timeRemaining: 0,
          nextEpisode: {
            kind: "complete",
          },
        })}
      />,
    )

    const links = screen.getAllByRole("link", { name: "Severance" })
    expect(links.length).toBeGreaterThanOrEqual(1)
    links.forEach((link) => expect(link).toHaveAttribute("href", "/tv/101"))
    expect(screen.getByText("Series complete")).toBeInTheDocument()
    expect(screen.queryByText("Next:")).not.toBeInTheDocument()
    expect(screen.queryByText(/left/)).not.toBeInTheDocument()
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
