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

vi.mock("@/components/watch-progress-options-menu", () => ({
  WatchProgressOptionsMenu: ({
    hideCompleted,
    onHideCompletedChange,
  }: {
    hideCompleted?: boolean
    onHideCompletedChange?: (checked: boolean) => void
  }) => (
    <div>
      <button
        type="button"
        data-testid="watch-progress-hide-completed-toggle"
        data-checked={hideCompleted ?? false}
        onClick={() => onHideCompletedChange?.(!(hideCompleted ?? false))}
      >
        Toggle hide completed
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
    lastUpdated?: number
    percentage?: number
  },
): WatchProgressItem => ({
  tvShowId: overrides.tvShowId,
  tvShowName: overrides.tvShowName,
  posterPath: null,
  backdropPath: null,
  lastUpdated: overrides.lastUpdated ?? Date.now(),
  percentage: overrides.percentage ?? 0,
  timeRemaining: overrides.timeRemaining ?? 120,
  lastWatchedEpisode: overrides.lastWatchedEpisode ?? {
    season: 1,
    episode: 1,
    title: "Episode 1",
  },
  nextEpisode:
    overrides.nextEpisode !== undefined
      ? overrides.nextEpisode
      : {
          kind: "unwatched",
          season: 1,
          episode: 2,
          title: "Episode 2",
        },
  watchedCount: overrides.watchedCount ?? 1,
  totalEpisodes: overrides.totalEpisodes ?? 10,
  avgRuntime: overrides.avgRuntime ?? 45,
  isHidden: overrides.isHidden ?? false,
  isUnavailable: overrides.isUnavailable,
})

describe("WatchProgressClient", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
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

  it("keeps completed and caught-up shows out of Watching and places them in Caught Up", () => {
    mocks.watchProgress = [
      buildShow({
        tvShowId: 1,
        tvShowName: "Complete Show",
        lastUpdated: 999,
        percentage: 100,
        nextEpisode: { kind: "complete" },
      }),
      buildShow({
        tvShowId: 2,
        tvShowName: "Caught Up Show",
        lastUpdated: 800,
        percentage: 100,
        nextEpisode: {
          kind: "upcoming",
          season: 2,
          episode: 1,
          title: "Season 2 Premiere",
        },
      }),
      buildShow({
        tvShowId: 3,
        tvShowName: "Still Watching",
        lastUpdated: 100,
        percentage: 65,
        nextEpisode: {
          kind: "unwatched",
          season: 1,
          episode: 2,
          title: "Episode 2",
        },
      }),
    ]

    render(<WatchProgressClient />)

    // In default Watching tab: only Still Watching is present
    expect(screen.queryByText("Complete Show")).not.toBeInTheDocument()
    expect(screen.queryByText("Caught Up Show")).not.toBeInTheDocument()
    expect(screen.getByText("Still Watching")).toBeInTheDocument()

    // Switch to Caught Up tab:
    const caughtUpTab = screen.getByTestId("watch-progress-caught-up-tab")
    fireEvent.click(caughtUpTab)

    expect(screen.getByText("Complete Show")).toBeInTheDocument()
    expect(screen.getByText("Caught Up Show")).toBeInTheDocument()
    expect(screen.queryByText("Still Watching")).not.toBeInTheDocument()
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
    const watchingTab = screen.getByTestId("watch-progress-watching-tab")
    fireEvent.click(watchingTab)

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

  it("hides completed shows from Caught Up when the persisted preference is on", () => {
    window.localStorage.setItem("watchProgressHideCompleted", "true")
    mocks.watchProgress = [
      buildShow({
        tvShowId: 1,
        tvShowName: "Complete Show",
        lastUpdated: 999,
        percentage: 100,
        nextEpisode: { kind: "complete" },
      }),
      buildShow({
        tvShowId: 2,
        tvShowName: "Caught Up Show",
        lastUpdated: 800,
        percentage: 100,
        nextEpisode: {
          kind: "upcoming",
          season: 2,
          episode: 1,
          title: "Season 2 Premiere",
        },
      }),
    ]

    render(<WatchProgressClient />)

    fireEvent.click(screen.getByTestId("watch-progress-caught-up-tab"))

    expect(screen.getByText("Caught Up Show")).toBeInTheDocument()
    expect(screen.queryByText("Complete Show")).not.toBeInTheDocument()
  })

  it("persists the hide-completed toggle to localStorage and filters the list", () => {
    mocks.watchProgress = [
      buildShow({
        tvShowId: 1,
        tvShowName: "Complete Show",
        lastUpdated: 999,
        percentage: 100,
        nextEpisode: { kind: "complete" },
      }),
      buildShow({
        tvShowId: 2,
        tvShowName: "Caught Up Show",
        lastUpdated: 800,
        percentage: 100,
        nextEpisode: {
          kind: "upcoming",
          season: 2,
          episode: 1,
          title: "Season 2 Premiere",
        },
      }),
    ]

    render(<WatchProgressClient />)

    fireEvent.click(screen.getByTestId("watch-progress-caught-up-tab"))
    expect(screen.getByText("Complete Show")).toBeInTheDocument()

    fireEvent.click(
      screen.getByTestId("watch-progress-hide-completed-toggle"),
    )

    expect(window.localStorage.getItem("watchProgressHideCompleted")).toBe(
      "true",
    )
    expect(screen.getByText("Caught Up Show")).toBeInTheDocument()
    expect(screen.queryByText("Complete Show")).not.toBeInTheDocument()
  })

  it("routes unavailable shows to the Hidden tab instead of Watching or Caught Up", () => {
    mocks.watchProgress = [
      buildShow({
        tvShowId: 101,
        tvShowName: "Healthy Watching Show",
        nextEpisode: {
          kind: "unwatched",
          season: 1,
          episode: 2,
          title: "Episode 2",
        },
      }),
      buildShow({
        tvShowId: 306684,
        tvShowName: "Dead TMDB Show",
        isUnavailable: true,
        isHidden: false,
        nextEpisode: null,
      }),
    ]

    render(<WatchProgressClient />)

    // Watching tab should only have the healthy show
    expect(screen.getByText("Healthy Watching Show")).toBeInTheDocument()
    expect(screen.queryByText("Dead TMDB Show")).not.toBeInTheDocument()

    // Caught Up tab should not have the unavailable show
    fireEvent.click(screen.getByTestId("watch-progress-caught-up-tab"))
    expect(screen.queryByText("Dead TMDB Show")).not.toBeInTheDocument()

    // Hidden tab MUST have the unavailable show
    fireEvent.click(screen.getByTestId("watch-progress-hidden-tab"))
    expect(screen.getByText("Dead TMDB Show")).toBeInTheDocument()
  })

  it("keeps a pre-enrichment show in the Watching tab so it does not disappear while awaiting TMDB data", () => {
    // Simulating computeProgressFromCache output before TMDB enrichment:
    // metadata.totalEpisodes was undefined -> totalEpisodes = 0, percentage = 0,
    // and provisional initialNextEpisode is unwatched
    mocks.watchProgress = [
      buildShow({
        tvShowId: 202,
        tvShowName: "Pre-Enrichment Show",
        totalEpisodes: 0,
        percentage: 0,
        watchedCount: 1,
        nextEpisode: {
          kind: "unwatched",
          season: 1,
          episode: 2,
          title: "Episode 2",
        },
      }),
    ]

    render(<WatchProgressClient />)

    // Pre-enrichment show must appear in Watching tab
    expect(screen.getByText("Pre-Enrichment Show")).toBeInTheDocument()

    // Must NOT appear in Caught Up tab
    fireEvent.click(screen.getByTestId("watch-progress-caught-up-tab"))
    expect(screen.queryByText("Pre-Enrichment Show")).not.toBeInTheDocument()

    // Must NOT appear in Hidden tab
    fireEvent.click(screen.getByTestId("watch-progress-hidden-tab"))
    expect(screen.queryByText("Pre-Enrichment Show")).not.toBeInTheDocument()
  })

  it("renders cached cards instead of skeletons while enrichment is still in flight", () => {
    mocks.watchProgress = [
      buildShow({
        tvShowId: 1,
        tvShowName: "Cached Show",
        percentage: 45,
      }),
    ]
    mocks.isEnriching = true

    render(<WatchProgressClient />)

    // Renderable card wins over the skeleton flash
    expect(
      screen.getByRole("link", { name: "Cached Show" }),
    ).toBeInTheDocument()
  })

  it("shows skeletons while enriching only when there is nothing renderable yet", () => {
    // Search filters out the only show, so sortedProgress is empty
    mocks.watchProgress = [
      buildShow({
        tvShowId: 1,
        tvShowName: "Cached Show",
        percentage: 45,
      }),
    ]
    mocks.isEnriching = true

    render(<WatchProgressClient />)

    fireEvent.change(screen.getByPlaceholderText("Search TV shows..."), {
      target: { value: "no-such-show" },
    })

    // Nothing renderable: no cards, and the search empty state waits until
    // enrichment settles (skeleton branch owns this state while enriching)
    expect(
      screen.queryByRole("link", { name: "Cached Show" }),
    ).not.toBeInTheDocument()
    expect(screen.queryByText("No results found")).not.toBeInTheDocument()
  })
})
