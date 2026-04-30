import { FavoriteEpisodesClient } from "@/app/lists/favorite-episodes/favorite-episodes-client"
import { render, screen } from "@/test/utils"
import { fireEvent } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  favoriteEpisodes: [] as Array<{
    id: string
    tvShowId: number
    seasonNumber: number
    episodeNumber: number
    episodeName: string
    showName: string
    posterPath: string | null
    addedAt: number
  }>,
  loading: false,
  user: {
    uid: "user-1",
    isAnonymous: false,
  } as { uid: string; isAnonymous?: boolean } | null,
}))

vi.mock("@/components/auth-modal", () => ({
  AuthModal: () => <div>auth-modal</div>,
}))

vi.mock("@/components/ui/filter-sort", () => ({
  FilterSort: ({
    onSortChange,
    onClearAll,
  }: {
    onSortChange: (state: { field: string; direction: string }) => void
    onClearAll?: () => void
  }) => (
    <div>
      <button
        type="button"
        onClick={() => onSortChange({ field: "showName", direction: "asc" })}
      >
        Sort by show title
      </button>
      <button
        type="button"
        onClick={() => onSortChange({ field: "episodeName", direction: "asc" })}
      >
        Sort by episode title
      </button>
      {onClearAll ? (
        <button type="button" onClick={onClearAll}>
          Clear all
        </button>
      ) : null}
    </div>
  ),
}))

vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({
    user: mocks.user,
    loading: false,
  }),
}))

vi.mock("@/hooks/use-favorite-episodes", () => ({
  useFavoriteEpisodes: () => ({
    episodes: mocks.favoriteEpisodes,
    count: mocks.favoriteEpisodes.length,
    loading: mocks.loading,
    error: null,
  }),
}))

vi.mock("@/hooks/use-poster-overrides", () => ({
  usePosterOverrides: () => ({
    overrides: {},
    resolvePosterPath: (
      _mediaType: "movie" | "tv",
      _mediaId: number,
      fallbackPosterPath: string | null | undefined,
    ) => fallbackPosterPath ?? null,
  }),
}))

describe("FavoriteEpisodesClient", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-03-14T12:00:00Z"))
    vi.clearAllMocks()
    mocks.favoriteEpisodes = []
    mocks.loading = false
    mocks.user = {
      uid: "user-1",
      isAnonymous: false,
    }
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("shows a signed-out prompt", async () => {
    mocks.user = null

    render(<FavoriteEpisodesClient />)

    expect(
      screen.getByText("Sign in to view your favorite episodes"),
    ).toBeInTheDocument()
  })

  it("shows an empty state when there are no favorite episodes", async () => {
    render(<FavoriteEpisodesClient />)

    expect(
      screen.getAllByText("No favorite episodes yet").length,
    ).toBeGreaterThan(0)
  })

  it("shows favorite episodes in recent-first order by default", () => {
    mocks.favoriteEpisodes = [
      {
        id: "101-2-4",
        tvShowId: 101,
        seasonNumber: 2,
        episodeNumber: 4,
        episodeName: "Arrival",
        showName: "Star Port",
        posterPath: "/poster-2.jpg",
        addedAt: Date.parse("2026-03-12T10:00:00Z"),
      },
      {
        id: "100-1-2",
        tvShowId: 100,
        seasonNumber: 1,
        episodeNumber: 2,
        episodeName: "Half Loop",
        showName: "Signal Run",
        posterPath: "/poster.jpg",
        addedAt: Date.parse("2026-03-14T09:00:00Z"),
      },
      {
        id: "102-3-1",
        tvShowId: 102,
        seasonNumber: 3,
        episodeNumber: 1,
        episodeName: "Aftermath",
        showName: "Red Valley",
        posterPath: "/poster-3.jpg",
        addedAt: Date.parse("2026-03-10T08:00:00Z"),
      },
    ]

    render(<FavoriteEpisodesClient />)

    expect(
      screen.getAllByRole("link").map((link) => link.getAttribute("href")),
    ).toEqual([
      "/tv/100/season/1/episode/2",
      "/tv/101/season/2/episode/4",
      "/tv/102/season/3/episode/1",
    ])
  })

  it("filters favorite episodes by search and links to the episode detail route", () => {
    mocks.favoriteEpisodes = [
      {
        id: "100-1-2",
        tvShowId: 100,
        seasonNumber: 1,
        episodeNumber: 2,
        episodeName: "Half Loop",
        showName: "Signal Run",
        posterPath: "/poster.jpg",
        addedAt: Date.parse("2026-03-14T09:00:00Z"),
      },
      {
        id: "101-2-4",
        tvShowId: 101,
        seasonNumber: 2,
        episodeNumber: 4,
        episodeName: "Arrival",
        showName: "Star Port",
        posterPath: "/poster-2.jpg",
        addedAt: Date.parse("2026-03-12T10:00:00Z"),
      },
    ]

    render(<FavoriteEpisodesClient />)

    expect(screen.getByRole("link", { name: /half loop/i })).toHaveAttribute(
      "href",
      "/tv/100/season/1/episode/2",
    )
    expect(screen.getByRole("link", { name: /arrival/i })).toHaveAttribute(
      "href",
      "/tv/101/season/2/episode/4",
    )

    fireEvent.change(screen.getByRole("textbox", { name: /search/i }), {
      target: { value: "arrival" },
    })

    expect(screen.queryByText("Half Loop")).not.toBeInTheDocument()
    expect(screen.getByText("Arrival")).toBeInTheDocument()
  })

  it("shows a no-results state when search excludes every episode", () => {
    mocks.favoriteEpisodes = [
      {
        id: "100-1-2",
        tvShowId: 100,
        seasonNumber: 1,
        episodeNumber: 2,
        episodeName: "Half Loop",
        showName: "Signal Run",
        posterPath: "/poster.jpg",
        addedAt: Date.parse("2026-03-14T09:00:00Z"),
      },
    ]

    render(<FavoriteEpisodesClient />)

    fireEvent.change(screen.getByRole("textbox", { name: /search/i }), {
      target: { value: "not-here" },
    })

    expect(screen.getByText("No results found")).toBeInTheDocument()
    expect(
      screen.getByText('No favorite episodes match "not-here".'),
    ).toBeInTheDocument()
  })

  it("sorts episodes by show title and episode title", () => {
    mocks.favoriteEpisodes = [
      {
        id: "101-2-4",
        tvShowId: 101,
        seasonNumber: 2,
        episodeNumber: 4,
        episodeName: "Arrival",
        showName: "Star Port",
        posterPath: "/poster-2.jpg",
        addedAt: Date.parse("2026-03-12T10:00:00Z"),
      },
      {
        id: "100-1-2",
        tvShowId: 100,
        seasonNumber: 1,
        episodeNumber: 2,
        episodeName: "Half Loop",
        showName: "Signal Run",
        posterPath: "/poster.jpg",
        addedAt: Date.parse("2026-03-14T09:00:00Z"),
      },
      {
        id: "102-3-1",
        tvShowId: 102,
        seasonNumber: 3,
        episodeNumber: 1,
        episodeName: "Aftermath",
        showName: "Red Valley",
        posterPath: "/poster-3.jpg",
        addedAt: Date.parse("2026-03-10T08:00:00Z"),
      },
    ]

    render(<FavoriteEpisodesClient />)

    fireEvent.click(screen.getByRole("button", { name: "Sort by show title" }))

    expect(
      screen.getAllByRole("link").map((link) => link.getAttribute("href")),
    ).toEqual([
      "/tv/102/season/3/episode/1",
      "/tv/100/season/1/episode/2",
      "/tv/101/season/2/episode/4",
    ])

    fireEvent.click(
      screen.getByRole("button", { name: "Sort by episode title" }),
    )

    expect(
      screen.getAllByRole("link").map((link) => link.getAttribute("href")),
    ).toEqual([
      "/tv/102/season/3/episode/1",
      "/tv/101/season/2/episode/4",
      "/tv/100/season/1/episode/2",
    ])
  })

  it("clears search and sort back to the default recent-first view", () => {
    mocks.favoriteEpisodes = [
      {
        id: "101-2-4",
        tvShowId: 101,
        seasonNumber: 2,
        episodeNumber: 4,
        episodeName: "Arrival",
        showName: "Star Port",
        posterPath: "/poster-2.jpg",
        addedAt: Date.parse("2026-03-12T10:00:00Z"),
      },
      {
        id: "100-1-2",
        tvShowId: 100,
        seasonNumber: 1,
        episodeNumber: 2,
        episodeName: "Half Loop",
        showName: "Signal Run",
        posterPath: "/poster.jpg",
        addedAt: Date.parse("2026-03-14T09:00:00Z"),
      },
    ]

    render(<FavoriteEpisodesClient />)

    fireEvent.change(screen.getByRole("textbox", { name: /search/i }), {
      target: { value: "arrival" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Sort by show title" }))
    fireEvent.click(screen.getByRole("button", { name: "Clear all" }))

    expect(screen.getByRole("textbox", { name: /search/i })).toHaveValue("")
    expect(
      screen.getAllByRole("link").map((link) => link.getAttribute("href")),
    ).toEqual(["/tv/100/season/1/episode/2", "/tv/101/season/2/episode/4"])
  })
})
