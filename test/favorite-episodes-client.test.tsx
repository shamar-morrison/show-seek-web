import { FavoriteEpisodesClient } from "@/app/lists/favorite-episodes/favorite-episodes-client"
import { render, screen } from "@/test/utils"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

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

describe("FavoriteEpisodesClient", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.favoriteEpisodes = []
    mocks.loading = false
    mocks.user = {
      uid: "user-1",
      isAnonymous: false,
    }
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

    expect(screen.getAllByText("No favorite episodes yet").length).toBeGreaterThan(
      0,
    )
  })

  it("filters favorite episodes by search and links to the episode detail route", async () => {
    const user = userEvent.setup()
    mocks.favoriteEpisodes = [
      {
        id: "100-1-2",
        tvShowId: 100,
        seasonNumber: 1,
        episodeNumber: 2,
        episodeName: "Half Loop",
        showName: "Signal Run",
        posterPath: "/poster.jpg",
        addedAt: 2,
      },
      {
        id: "101-2-4",
        tvShowId: 101,
        seasonNumber: 2,
        episodeNumber: 4,
        episodeName: "Arrival",
        showName: "Star Port",
        posterPath: "/poster-2.jpg",
        addedAt: 1,
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

    await user.type(
      screen.getByRole("textbox", { name: /search/i }),
      "arrival",
    )

    expect(screen.queryByText("Half Loop")).not.toBeInTheDocument()
    expect(screen.getByText("Arrival")).toBeInTheDocument()
  })
})
