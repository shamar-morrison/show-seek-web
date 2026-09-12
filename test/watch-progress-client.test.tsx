import { WatchProgressClient } from "@/app/lists/watch-progress/watch-progress-client"
import type { WatchProgressItem } from "@/hooks/use-episode-tracking"
import { render, screen } from "@/test/utils"
import { fireEvent } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  watchProgress: [] as WatchProgressItem[],
  isEnriching: false,
  trackingLoading: false,
  authLoading: false,
}))

vi.mock("@/components/ui/filter-sort", () => ({
  FilterSort: ({
    onSortChange,
  }: {
    onSortChange: (state: { field: string; direction: "asc" | "desc" }) => void
  }) => (
    <div>
      <button
        type="button"
        onClick={() => onSortChange({ field: "progress", direction: "desc" })}
      >
        Sort by progress
      </button>
      <button
        type="button"
        onClick={() =>
          onSortChange({ field: "alphabetical", direction: "asc" })
        }
      >
        Sort alphabetically
      </button>
    </div>
  ),
}))

vi.mock("@/components/watch-progress-card", () => ({
  WatchProgressCard: ({ progress }: { progress: WatchProgressItem }) => (
    <a href={`/tv/${progress.tvShowId}`}>{progress.tvShowName}</a>
  ),
}))

vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({
    user: { uid: "user-1", isAnonymous: false },
    loading: mocks.authLoading,
  }),
}))

vi.mock("@/hooks/use-episode-tracking", () => ({
  useEpisodeTracking: () => ({
    watchProgress: mocks.watchProgress,
    watchedEpisodesByShow: new Map<number, Set<string>>(),
    loading: mocks.trackingLoading,
  }),
}))

vi.mock("@/hooks/use-watch-progress-enrichment", () => ({
  useWatchProgressEnrichment: (watchProgress: WatchProgressItem[]) => ({
    enrichedProgress: watchProgress,
    isEnriching: mocks.isEnriching,
  }),
}))

const buildShow = (
  overrides: Partial<WatchProgressItem> & {
    tvShowId: number
    tvShowName: string
    lastUpdated: number
    percentage: number
  },
): WatchProgressItem => ({
  tvShowId: overrides.tvShowId,
  tvShowName: overrides.tvShowName,
  posterPath: null,
  backdropPath: null,
  lastUpdated: overrides.lastUpdated,
  percentage: overrides.percentage,
  timeRemaining: overrides.timeRemaining ?? 120,
  lastWatchedEpisode: overrides.lastWatchedEpisode ?? {
    season: 1,
    episode: 1,
    title: "Episode 1",
  },
  nextEpisode: overrides.nextEpisode ?? {
    season: 1,
    episode: 2,
    title: "Episode 2",
    airDate: null,
  },
  watchedCount: overrides.watchedCount ?? 1,
  totalEpisodes: overrides.totalEpisodes ?? 10,
  avgRuntime: overrides.avgRuntime ?? 45,
  isHidden: overrides.isHidden ?? false,
})

describe("WatchProgressClient", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.watchProgress = []
    mocks.isEnriching = false
    mocks.trackingLoading = false
    mocks.authLoading = false
  })

  it("shows in-progress series in last-watched order by default", () => {
    mocks.watchProgress = [
      buildShow({
        tvShowId: 1,
        tvShowName: "Beta Squad",
        lastUpdated: 200,
        percentage: 45,
      }),
      buildShow({
        tvShowId: 2,
        tvShowName: "Alpha Run",
        lastUpdated: 500,
        percentage: 35,
      }),
      buildShow({
        tvShowId: 3,
        tvShowName: "Gamma Signal",
        lastUpdated: 100,
        percentage: 80,
      }),
    ]

    render(<WatchProgressClient />)

    expect(
      screen.getAllByRole("link").map((link) => link.getAttribute("href")),
    ).toEqual(["/tv/2", "/tv/1", "/tv/3"])
  })

  it("sorts watch progress by completion percentage", () => {
    mocks.watchProgress = [
      buildShow({
        tvShowId: 1,
        tvShowName: "Beta Squad",
        lastUpdated: 200,
        percentage: 45,
      }),
      buildShow({
        tvShowId: 2,
        tvShowName: "Alpha Run",
        lastUpdated: 500,
        percentage: 35,
      }),
      buildShow({
        tvShowId: 3,
        tvShowName: "Gamma Signal",
        lastUpdated: 100,
        percentage: 80,
      }),
    ]

    render(<WatchProgressClient />)

    fireEvent.click(screen.getByRole("button", { name: "Sort by progress" }))

    expect(
      screen.getAllByRole("link").map((link) => link.getAttribute("href")),
    ).toEqual(["/tv/3", "/tv/1", "/tv/2"])
  })

  it("sorts watch progress alphabetically", () => {
    mocks.watchProgress = [
      buildShow({
        tvShowId: 1,
        tvShowName: "Beta Squad",
        lastUpdated: 200,
        percentage: 45,
      }),
      buildShow({
        tvShowId: 2,
        tvShowName: "Alpha Run",
        lastUpdated: 500,
        percentage: 35,
      }),
      buildShow({
        tvShowId: 3,
        tvShowName: "Gamma Signal",
        lastUpdated: 100,
        percentage: 80,
      }),
    ]

    render(<WatchProgressClient />)

    fireEvent.click(screen.getByRole("button", { name: "Sort alphabetically" }))

    expect(
      screen.getAllByRole("link").map((link) => link.getAttribute("href")),
    ).toEqual(["/tv/2", "/tv/1", "/tv/3"])
  })

  it("keeps search filtering working after sorting is added", () => {
    mocks.watchProgress = [
      buildShow({
        tvShowId: 1,
        tvShowName: "Beta Squad",
        lastUpdated: 200,
        percentage: 45,
      }),
      buildShow({
        tvShowId: 2,
        tvShowName: "Alpha Run",
        lastUpdated: 500,
        percentage: 35,
      }),
      buildShow({
        tvShowId: 3,
        tvShowName: "Gamma Signal",
        lastUpdated: 100,
        percentage: 80,
      }),
    ]

    render(<WatchProgressClient />)

    fireEvent.change(screen.getByPlaceholderText("Search TV shows..."), {
      target: { value: "gamma" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Sort alphabetically" }))

    expect(screen.queryByText("Alpha Run")).not.toBeInTheDocument()
    expect(screen.queryByText("Beta Squad")).not.toBeInTheDocument()
    expect(screen.getByText("Gamma Signal")).toBeInTheDocument()
  })

  it("shows the no-results state when search excludes every show", () => {
    mocks.watchProgress = [
      buildShow({
        tvShowId: 1,
        tvShowName: "Beta Squad",
        lastUpdated: 200,
        percentage: 45,
      }),
    ]

    render(<WatchProgressClient />)

    fireEvent.change(screen.getByPlaceholderText("Search TV shows..."), {
      target: { value: "missing" },
    })

    expect(screen.getByText("No results found")).toBeInTheDocument()
    expect(screen.getByText('No shows match "missing"')).toBeInTheDocument()
  })

  it("keeps fully completed shows out of the list", () => {
    mocks.watchProgress = [
      buildShow({
        tvShowId: 1,
        tvShowName: "Complete Show",
        lastUpdated: 999,
        percentage: 100,
      }),
      buildShow({
        tvShowId: 2,
        tvShowName: "Still Watching",
        lastUpdated: 100,
        percentage: 65,
      }),
    ]

    render(<WatchProgressClient />)

    expect(screen.queryByText("Complete Show")).not.toBeInTheDocument()
    expect(screen.getByText("Still Watching")).toBeInTheDocument()
  })

  it("excludes hidden shows from default Watching view and displays them in the Hidden tab", () => {
    mocks.watchProgress = [
      buildShow({
        tvShowId: 10,
        tvShowName: "Visible Show",
        lastUpdated: 200,
        percentage: 30,
        isHidden: false,
      }),
      buildShow({
        tvShowId: 20,
        tvShowName: "Archived Show",
        lastUpdated: 300,
        percentage: 50,
        isHidden: true,
      }),
    ]

    render(<WatchProgressClient />)

    // In default Watching tab: only Visible Show is present
    expect(screen.getByText("Visible Show")).toBeInTheDocument()
    expect(screen.queryByText("Archived Show")).not.toBeInTheDocument()

    // Switch to Hidden tab
    const hiddenTab = screen.getByTestId("watch-progress-hidden-tab")
    fireEvent.click(hiddenTab)

    // In Hidden tab: only Archived Show is present
    expect(screen.getByText("Archived Show")).toBeInTheDocument()
    expect(screen.queryByText("Visible Show")).not.toBeInTheDocument()

    // Switch back to Watching tab
    const activeTab = screen.getByTestId("watch-progress-active-tab")
    fireEvent.click(activeTab)

    expect(screen.getByText("Visible Show")).toBeInTheDocument()
    expect(screen.queryByText("Archived Show")).not.toBeInTheDocument()
  })

  it("filters independently within the Hidden tab using search", () => {
    mocks.watchProgress = [
      buildShow({
        tvShowId: 1,
        tvShowName: "Hidden Alpha",
        lastUpdated: 100,
        percentage: 20,
        isHidden: true,
      }),
      buildShow({
        tvShowId: 2,
        tvShowName: "Hidden Beta",
        lastUpdated: 200,
        percentage: 40,
        isHidden: true,
      }),
    ]

    render(<WatchProgressClient />)

    // Switch to Hidden tab
    fireEvent.click(screen.getByTestId("watch-progress-hidden-tab"))
    expect(screen.getByText("Hidden Alpha")).toBeInTheDocument()
    expect(screen.getByText("Hidden Beta")).toBeInTheDocument()

    // Search for "alpha"
    fireEvent.change(screen.getByPlaceholderText("Search TV shows..."), {
      target: { value: "alpha" },
    })

    expect(screen.getByText("Hidden Alpha")).toBeInTheDocument()
    expect(screen.queryByText("Hidden Beta")).not.toBeInTheDocument()
  })
})
