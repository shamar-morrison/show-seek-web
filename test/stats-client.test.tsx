import { beforeEach, describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { StatsClient, activityHref } from "@/components/stats/stats-client"
import { HistoryCalculator, type HistorySource } from "@/lib/history/calculator"
import type { ActivityItem } from "@/types/history"

const { mockHistory, refresh } = vi.hoisted(() => ({
  mockHistory: vi.fn(),
  refresh: vi.fn(),
}))
vi.mock("@/hooks/use-history", () => ({ useHistory: mockHistory }))
const now = new Date(2026, 2, 9, 12).getTime()
const source: HistorySource = {
  episodes: [
    {
      tvShowId: 500,
      episodeId: 1,
      episodeName: "Pilot",
      seasonNumber: 1,
      episodeNumber: 1,
      watchedAt: now,
      runtimeMinutes: 42,
      episodeAirDate: null,
      tvShowName: "Grouped Show",
      posterPath: null,
    },
  ],
  ratings: [
    {
      id: "season-500-3",
      mediaType: "season",
      tvShowId: 500,
      seasonNumber: 3,
      ratedAt: now,
      rating: 9,
    },
  ],
  lists: [
    {
      id: "watchlist",
      name: "Watchlist",
      createdAt: now,
      items: {
        "movie-101": {
          id: 101,
          title: "Added Movie",
          media_type: "movie",
          poster_path: null,
          addedAt: now,
        },
      },
    },
  ],
}
const calculator = new HistoryCalculator(source, now)
const result = () => ({
  overview: calculator.overview({}),
  detail: calculator.detail("2026-03", {}),
  loading: false,
  fetching: false,
  error: null,
  cooldown: 0,
  deferred: false,
  refresh,
})
beforeEach(() => {
  mockHistory.mockReturnValue(result())
  refresh.mockClear()
})

describe("Stats & History screens", () => {
  it("shows the mobile overview, patterns, and linked monthly breakdown", () => {
    render(<StatsClient genres={{}} />)
    expect(
      screen.getByRole("heading", { name: "Last 6 Months Overview" }),
    ).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Streaks" })).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "Activity Patterns" }),
    ).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /March 2026/ })).toHaveAttribute(
      "href",
      "/lists/stats/2026-03",
    )
    expect(screen.getAllByText("0hrs 42mins")).toHaveLength(2)
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }))
    expect(refresh).toHaveBeenCalledTimes(1)
  })
  it("switches detail categories and links to the correct media and season pages", () => {
    render(<StatsClient genres={{}} month="2026-03" />)
    expect(screen.getByRole("link", { name: /Grouped Show/ })).toHaveAttribute(
      "href",
      "/tv/500",
    )
    fireEvent.click(screen.getByRole("button", { name: /Rated/ }))
    expect(screen.getByRole("link", { name: /Season 3/ })).toHaveAttribute(
      "href",
      "/tv/500/season/3",
    )
    expect(screen.getByLabelText("Rating 9 out of 10")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /Added/ }))
    expect(screen.getByRole("link", { name: /Added Movie/ })).toHaveAttribute(
      "href",
      "/movie/101",
    )
  })
  it("matches mobile's Watched tab count when multiple episodes share one row", () => {
    const c = new HistoryCalculator(
      {
        ...source,
        episodes: [
          source.episodes[0],
          { ...source.episodes[0], episodeId: 2, episodeNumber: 2 },
        ],
      },
      now,
    )
    mockHistory.mockReturnValue({
      ...result(),
      detail: c.detail("2026-03", {}),
    })
    render(<StatsClient genres={{}} month="2026-03" />)
    expect(screen.getByRole("button", { name: /Watched/ })).toHaveTextContent(
      "Watched2",
    )
    expect(screen.getAllByRole("link", { name: /Grouped Show/ })).toHaveLength(
      1,
    )
  })
  it("selects the first populated category when only ratings are available", () => {
    const c = new HistoryCalculator({ ...source, episodes: [], lists: [] }, now)
    mockHistory.mockReturnValue({
      ...result(),
      detail: c.detail("2026-03", {}),
    })
    render(<StatsClient genres={{}} month="2026-03" />)
    expect(screen.getByRole("button", { name: /Rated/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    )
    fireEvent.click(screen.getByRole("button", { name: /Watched/ }))
    expect(screen.getByText("Nothing watched this month")).toBeInTheDocument()
  })
  it("disables refresh during the persisted cooldown and while fetching", () => {
    mockHistory.mockReturnValue({ ...result(), cooldown: 42 })
    const view = render(<StatsClient genres={{}} />)
    expect(screen.getByRole("button", { name: "Refresh" })).toBeDisabled()
    expect(screen.getByRole("status")).toHaveTextContent(
      "Refresh available in 42s",
    )
    mockHistory.mockReturnValue({ ...result(), fetching: true })
    view.rerender(<StatsClient genres={{}} />)
    expect(screen.getByRole("button", { name: "Refresh" })).toBeDisabled()
    expect(screen.getByRole("status")).toHaveTextContent("Updating stats")
  })
  it("retains saved stats during a failed refresh and provides retry", () => {
    mockHistory.mockReturnValue({ ...result(), error: new Error("offline") })
    render(<StatsClient genres={{}} />)
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Showing your saved activity",
    )
    expect(
      screen.getByRole("heading", { name: "Last 6 Months Overview" }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Retry" }))
    expect(refresh).toHaveBeenCalledTimes(1)
  })
  it("shows loading and empty states", () => {
    mockHistory.mockReturnValue({ ...result(), loading: true })
    const view = render(<StatsClient genres={{}} />)
    expect(screen.getByLabelText("Loading stats")).toBeInTheDocument()
    const c = new HistoryCalculator(
      { episodes: [], ratings: [], lists: [] },
      now,
    )
    mockHistory.mockReturnValue({
      ...result(),
      overview: c.overview({}),
      detail: c.detail("2026-03", {}),
    })
    view.rerender(<StatsClient genres={{}} />)
    expect(screen.getByText("No activity yet")).toBeInTheDocument()
    view.rerender(<StatsClient genres={{}} month="2026-03" />)
    expect(screen.getByText("No activity this month")).toBeInTheDocument()
  })
  it("does not generate broken destinations for legacy ratings lacking navigation metadata", () => {
    const episode: ActivityItem = {
      id: "episode-500-1-1",
      type: "rated",
      mediaType: "episode",
      title: "Pilot",
      posterPath: null,
      timestamp: now,
    }
    expect(activityHref(episode)).toBeNull()
    expect(activityHref({ ...episode, tvShowId: 500 })).toBe("/tv/500")
  })
})
