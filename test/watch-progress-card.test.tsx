import { WatchProgressCard } from "@/components/watch-progress-card"
import { render, screen } from "@/test/utils"
import type { WatchProgressItem } from "@/hooks/use-episode-tracking"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  clearAllEpisodes: vi.fn(),
  resolvePosterPath: vi.fn(
    (_mediaType: "tv", _mediaId: number, fallbackPosterPath: string | null) =>
      fallbackPosterPath,
  ),
}))

vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTrigger: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
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
  AlertDialogAction: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
}))

vi.mock("@/hooks/use-episode-tracking-mutations", () => ({
  useEpisodeTrackingMutations: () => ({
    clearAllEpisodes: mocks.clearAllEpisodes,
  }),
}))

vi.mock("@/hooks/use-poster-overrides", () => ({
  usePosterOverrides: () => ({
    resolvePosterPath: mocks.resolvePosterPath,
  }),
}))

function createProgress(): WatchProgressItem {
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
})
