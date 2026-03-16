import { RatingsPageClient } from "@/app/ratings/ratings-page-client"
import { render, screen } from "@/test/utils"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

function createDefaultMovieRatings() {
  return [
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
    {
      id: "movie-456",
      mediaId: "456",
      mediaType: "movie" as const,
      rating: 8,
      title: "Your Name",
      originalTitle: "Kimi no Na wa.",
      posterPath: null,
      releaseDate: "2016-08-26",
      ratedAt: 2,
    },
  ]
}

const mocks = vi.hoisted(() => ({
  watchTrailer: vi.fn(),
  closeTrailer: vi.fn(),
  movieRatings: createDefaultMovieRatings(),
  preferences: {
    showOriginalTitles: true,
  },
}))

const originalTimeZone = process.env.TZ

function restoreTimeZone() {
  if (originalTimeZone === undefined) {
    delete process.env.TZ
    return
  }

  process.env.TZ = originalTimeZone
}

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

vi.mock("@/components/ui/filter-sort", () => ({
  FilterSort: ({
    onSortChange,
    yearRange,
  }: {
    onSortChange: (state: { field: string; direction: string }) => void
    yearRange?: { onChange: (range: [number, number]) => void }
  }) => (
    <>
      <button
        type="button"
        onClick={() => onSortChange({ field: "title", direction: "asc" })}
      >
        Sort title
      </button>
      <button
        type="button"
        onClick={() =>
          onSortChange({ field: "releaseDate", direction: "asc" })
        }
      >
        Sort release
      </button>
      <button
        type="button"
        onClick={() => yearRange?.onChange([2024, 2024])}
      >
        Year 2024
      </button>
    </>
  ),
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
    (() => {
      const canonicalTitle = media.title ?? media.name ?? ""
      const originalTitle = media.original_title ?? media.original_name ?? ""
      const displayTitle = mocks.preferences.showOriginalTitles
        ? originalTitle || canonicalTitle
        : canonicalTitle || originalTitle

      return (
        <div
          data-testid="media-card"
          data-title={canonicalTitle}
          data-original-title={originalTitle}
        >
          {displayTitle}
        </div>
      )
    })()
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
    mocks.movieRatings = createDefaultMovieRatings()
    mocks.preferences.showOriginalTitles = true
  })

  afterEach(() => {
    restoreTimeZone()
  })

  it("rehydrates original titles for cards and searches both title variants", async () => {
    const user = userEvent.setup()

    const { rerender } = render(<RatingsPageClient />)

    const card = screen
      .getByText("Sen to Chihiro no Kamikakushi")
      .closest('[data-testid="media-card"]')

    expect(card).not.toBeNull()
    expect(card).toHaveAttribute("data-title", "Spirited Away")
    expect(card).toHaveAttribute(
      "data-original-title",
      "Sen to Chihiro no Kamikakushi",
    )
    expect(screen.getByText("Sen to Chihiro no Kamikakushi")).toBeInTheDocument()

    await user.type(
      screen.getByPlaceholderText("Search your ratings..."),
      "Chihiro",
    )

    expect(screen.getAllByTestId("media-card")).toHaveLength(1)

    mocks.preferences.showOriginalTitles = false
    rerender(<RatingsPageClient />)

    expect(screen.getByText("Spirited Away")).toBeInTheDocument()
  })

  it("sorts ratings alphabetically by the displayed title", async () => {
    const user = userEvent.setup()

    render(<RatingsPageClient />)

    await user.click(screen.getByRole("button", { name: "Sort title" }))

    const cards = screen.getAllByTestId("media-card")
    expect(cards[0]).toHaveTextContent("Kimi no Na wa.")
    expect(cards[1]).toHaveTextContent("Sen to Chihiro no Kamikakushi")
  })

  it("keeps January 1 ratings in the correct release year filter", async () => {
    process.env.TZ = "America/Jamaica"
    mocks.movieRatings = [
      {
        id: "movie-jan",
        mediaId: "10",
        mediaType: "movie" as const,
        rating: 9,
        title: "January First",
        originalTitle: "",
        posterPath: null,
        releaseDate: "2024-01-01",
        ratedAt: 2,
      },
      {
        id: "movie-dec",
        mediaId: "11",
        mediaType: "movie" as const,
        rating: 8,
        title: "December Finale",
        originalTitle: "",
        posterPath: null,
        releaseDate: "2023-12-31",
        ratedAt: 1,
      },
    ]

    const user = userEvent.setup()

    render(<RatingsPageClient />)

    await user.click(screen.getByRole("button", { name: "Year 2024" }))

    expect(screen.getByText("January First")).toBeInTheDocument()
    expect(screen.queryByText("December Finale")).not.toBeInTheDocument()
  })

  it("sorts ratings by TMDB release dates without timezone drift", async () => {
    process.env.TZ = "America/Jamaica"
    mocks.movieRatings = [
      {
        id: "movie-jan",
        mediaId: "10",
        mediaType: "movie" as const,
        rating: 9,
        title: "January First",
        originalTitle: "",
        posterPath: null,
        releaseDate: "2024-01-01",
        ratedAt: 2,
      },
      {
        id: "movie-dec",
        mediaId: "11",
        mediaType: "movie" as const,
        rating: 8,
        title: "December Finale",
        originalTitle: "",
        posterPath: null,
        releaseDate: "2023-12-31",
        ratedAt: 1,
      },
    ]

    const user = userEvent.setup()

    render(<RatingsPageClient />)

    await user.click(screen.getByRole("button", { name: "Sort release" }))

    const cards = screen.getAllByTestId("media-card")
    expect(cards[0]).toHaveTextContent("December Finale")
    expect(cards[1]).toHaveTextContent("January First")
  })
})
