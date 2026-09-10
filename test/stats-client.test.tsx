import { StatsClient } from "@/app/stats/stats-client"
import { MonthDetailClient } from "@/app/stats/[month]/month-detail-client"
import { render, screen } from "@/test/utils"
import type { WatchTimeStats } from "@/hooks/use-watch-time-stats"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  stats: null as WatchTimeStats | null,
  backfillArgs: null as Record<string, unknown> | null,
}))

vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({ user: { uid: "user-1", isAnonymous: false }, loading: false }),
}))

vi.mock("@/hooks/use-watch-time-stats", () => ({
  useWatchTimeStats: () => mocks.stats,
}))

vi.mock("@/hooks/use-genre-map", () => ({
  useGenreMap: () => ({ data: { 28: "Action", 12: "Adventure" } }),
}))

vi.mock("@/hooks/use-watch-time-backfill", () => ({
  useWatchTimeBackfill: (args: Record<string, unknown>) => {
    mocks.backfillArgs = args
  },
}))

vi.mock("@hugeicons/react", () => ({
  HugeiconsIcon: () => <svg />,
}))

function baseStats(): WatchTimeStats {
  return {
    totalWatchMinutes: 155,
    episodeCount: 2,
    alreadyWatchedCount: 1,
    ratedCount: 3,
    totalAddedToLists: 2,
    currentStreak: 4,
    longestStreak: 9,
    mostActiveDay: "Saturday",
    mostActiveTimeOfDay: "Evening",
    months: [
      {
        key: "2026-09",
        label: "September 2026",
        totalWatchMinutes: 155,
        watched: 3,
        episodeCount: 2,
        alreadyWatchedCount: 1,
        ratedCount: 3,
        addedToListsCount: 1,
        averageRating: 8.5,
        topGenres: ["Action"],
        comparisonToPrevious: { watched: 50 },
        episodes: [
          {
            tvShowId: 100,
            tvShowName: "Show",
            seasonNumber: 1,
            episodeNumber: 1,
            episodeName: "Pilot",
            watchedAt: 1,
            minutes: 50,
          },
        ],
        items: [
          {
            mediaId: 1,
            mediaType: "movie",
            title: "Film",
            addedAt: 2,
            minutes: 105,
          },
        ],
        rated: [
          {
            mediaId: "1",
            mediaType: "movie",
            title: "Film",
            rating: 9,
            ratedAt: 3,
          },
        ],
        added: [
          {
            listId: "watchlist",
            itemKey: "movie-1",
            mediaId: 1,
            mediaType: "movie",
            title: "Film",
            posterPath: null,
            addedAt: 2,
          },
        ],
      },
    ],
    unstampedEpisodes: [],
    unstampedListItems: [],
    loading: false,
  }
}

describe("StatsClient", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.stats = baseStats()
    mocks.backfillArgs = null
  })

  it("renders the overview with mobile-exact duration formatting", () => {
    render(<StatsClient />)

    expect(screen.getByText("Last 6 Months Overview")).toBeInTheDocument()
    expect(screen.getAllByText("2hrs 35mins")).toHaveLength(2)
    expect(screen.getByText("September 2026")).toBeInTheDocument()
  })

  it("links monthly cards to the detail route", () => {
    render(<StatsClient />)

    expect(screen.getByRole("link", { name: /September 2026/ })).toHaveAttribute(
      "href",
      "/stats/2026-09",
    )
  })

  it("renders streaks, activity patterns, comparison badge, and top genres", () => {
    render(<StatsClient />)

    expect(screen.getByText("Streaks")).toBeInTheDocument()
    expect(screen.getByText("Current Streak")).toBeInTheDocument()
    expect(screen.getByText("Longest Streak")).toBeInTheDocument()
    expect(screen.getByText("Activity Patterns")).toBeInTheDocument()
    expect(screen.getByText("Saturday")).toBeInTheDocument()
    expect(screen.getByText("Evening")).toBeInTheDocument()
    expect(screen.getByText("+50% vs last month")).toBeInTheDocument()
    expect(screen.getByText("Action")).toBeInTheDocument()
    expect(screen.getByText("8.5 avg rating")).toBeInTheDocument()
  })

  it("shows an empty state with no watch history", () => {
    mocks.stats = {
      ...baseStats(),
      totalWatchMinutes: 0,
      episodeCount: 0,
      alreadyWatchedCount: 0,
      ratedCount: 0,
      months: [],
    }

    render(<StatsClient />)

    expect(screen.getByText("No watch history yet")).toBeInTheDocument()
  })
})

describe("MonthDetailClient", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.stats = baseStats()
  })

  it("renders the month summary with grouped watched tab by default", () => {
    render(<MonthDetailClient monthKey="2026-09" />)

    expect(screen.getByText("September 2026")).toBeInTheDocument()
    expect(screen.getByText("2hrs 35mins")).toBeInTheDocument()
    // Episodes grouped by show.
    expect(screen.getByText("Show")).toBeInTheDocument()
    expect(screen.getByText("1 episode")).toBeInTheDocument()
    expect(screen.getByText("Film")).toBeInTheDocument()
    // Tabs with counts.
    expect(screen.getByRole("tab", { name: /Watched/ })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /Rated/ })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /Added/ })).toBeInTheDocument()
  })

  it("switches to the rated and added tabs", async () => {
    const userEvent = (await import("@testing-library/user-event")).default
    const user = userEvent.setup()

    render(<MonthDetailClient monthKey="2026-09" />)

    await user.click(screen.getByRole("tab", { name: /Rated/ }))
    expect(screen.getByText("9/10")).toBeInTheDocument()

    await user.click(screen.getByRole("tab", { name: /Added/ }))
    expect(screen.getByText("Film")).toBeInTheDocument()
  })

  it("shows a no-activity state for unknown months", () => {
    render(<MonthDetailClient monthKey="2020-01" />)

    expect(screen.getByText("No activity")).toBeInTheDocument()
  })
})
