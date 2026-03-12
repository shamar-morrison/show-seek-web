import { RatingsPageClient } from "@/app/ratings/ratings-page-client"
import { render, screen } from "@/test/utils"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  watchTrailer: vi.fn(),
  closeTrailer: vi.fn(),
  movieRatings: [
    {
      id: "movie-123",
      mediaId: "123",
      mediaType: "movie" as const,
      rating: 9,
      title: "Spirited Away",
      originalTitle: "Sen to Chihiro no Kamikakushi",
      posterPath: null,
      releaseDate: "2001-07-20",
      ratedAt: 1,
    },
  ],
  preferences: {
    showOriginalTitles: true,
  },
}))

vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({
    loading: false,
  }),
}))

vi.mock("@/hooks/use-preferences", () => ({
  usePreferences: () => ({
    preferences: mocks.preferences,
  }),
}))

vi.mock("@/hooks/use-ratings", () => ({
  useMovieRatings: () => ({
    ratings: mocks.movieRatings,
    loading: false,
    count: mocks.movieRatings.length,
  }),
  useTVRatings: () => ({
    ratings: [],
    loading: false,
    count: 0,
  }),
  useEpisodeRatings: () => ({
    ratings: [],
    loading: false,
    count: 0,
  }),
}))

vi.mock("@/hooks/use-trailer", () => ({
  useTrailer: () => ({
    isOpen: false,
    activeTrailer: null,
    loadingMediaId: null,
    watchTrailer: mocks.watchTrailer,
    closeTrailer: mocks.closeTrailer,
  }),
}))

vi.mock("@/components/media-card-with-actions", () => ({
  MediaCardWithActions: ({
    media,
  }: {
    media: {
      title?: string
      name?: string
      original_title?: string
      original_name?: string
    }
  }) => (
    <div
      data-testid="media-card"
      data-title={media.title ?? media.name ?? ""}
      data-original-title={media.original_title ?? media.original_name ?? ""}
    >
      {media.original_title ?? media.original_name ?? media.title ?? media.name}
    </div>
  ),
}))

vi.mock("@/components/ratings/episode-rating-card", () => ({
  EpisodeRatingCard: () => <div>episode-card</div>,
}))

vi.mock("@/components/trailer-modal", () => ({
  TrailerModal: () => null,
}))

describe("RatingsPageClient", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("rehydrates original titles for cards and searches both title variants", async () => {
    const user = userEvent.setup()

    render(<RatingsPageClient />)

    const card = screen.getByTestId("media-card")
    expect(card).toHaveAttribute(
      "data-original-title",
      "Sen to Chihiro no Kamikakushi",
    )
    expect(screen.getByText("Sen to Chihiro no Kamikakushi")).toBeInTheDocument()

    await user.type(
      screen.getByPlaceholderText("Search your ratings..."),
      "Chihiro",
    )

    expect(screen.getByTestId("media-card")).toBeInTheDocument()
  })
})
