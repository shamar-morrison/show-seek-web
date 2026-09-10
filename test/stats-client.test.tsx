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
    months: [
      {
        key: "2026-09",
        label: "September 2026",
        totalWatchMinutes: 155,
        episodeCount: 2,
        alreadyWatchedCount: 1,
        ratedCount: 3,
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

  it("renders the month summary and item rows", () => {
    render(<MonthDetailClient monthKey="2026-09" />)

    expect(screen.getByText("September 2026")).toBeInTheDocument()
    expect(screen.getByText("2hrs 35mins")).toBeInTheDocument()
    expect(screen.getByText("Show")).toBeInTheDocument()
    expect(
      screen.getByText((_, element) => element?.textContent === "S1 E1 · Pilot"),
    ).toBeInTheDocument()
    expect(screen.getByText("Film")).toBeInTheDocument()
  })

  it("shows a no-activity state for unknown months", () => {
    render(<MonthDetailClient monthKey="2020-01" />)

    expect(screen.getByText("No activity")).toBeInTheDocument()
  })
})
