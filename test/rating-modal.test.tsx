import { RatingModal } from "@/components/rating-modal"
import { render, screen, waitFor } from "@/test/utils"
import type { TMDBMovieDetails } from "@/types/tmdb"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getRating: vi.fn(),
  removeRating: vi.fn(),
  saveRating: vi.fn(),
  preferences: {
    showOriginalTitles: false,
  },
}))

vi.mock("@/hooks/use-preferences", () => ({
  usePreferences: () => ({
    preferences: mocks.preferences,
  }),
}))

vi.mock("@/hooks/use-ratings", () => ({
  useRatings: () => ({
    getRating: mocks.getRating,
    saveRating: mocks.saveRating,
    removeRating: mocks.removeRating,
  }),
}))

vi.mock("@/components/ui/base-media-modal", () => ({
  BaseMediaModal: ({
    children,
    title,
    description,
  }: {
    children: React.ReactNode
    title: string
    description?: string
  }) => (
    <div>
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
      {children}
    </div>
  ),
}))

function createMovie(): TMDBMovieDetails {
  return {
    id: 123,
    title: "Spirited Away",
    original_title: "Sen to Chihiro no Kamikakushi",
    original_language: "ja",
    overview: "Overview",
    poster_path: null,
    backdrop_path: null,
    release_date: "2001-07-20",
    runtime: 125,
    vote_average: 8.5,
    vote_count: 100,
    genres: [],
    status: "Released",
    tagline: null,
    adult: false,
    budget: 0,
    homepage: null,
    imdb_id: null,
    revenue: 0,
    video: false,
    production_companies: [],
    production_countries: [],
    spoken_languages: [],
    belongs_to_collection: null,
  }
}

describe("RatingModal", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getRating.mockReturnValue(null)
    mocks.saveRating.mockResolvedValue(undefined)
  })

  it("saves canonical and original titles together", async () => {
    const user = userEvent.setup()

    render(
      <RatingModal
        isOpen
        onClose={vi.fn()}
        media={createMovie()}
        mediaType="movie"
      />,
    )

    await user.click(screen.getByRole("button", { name: "Rate 8 out of 10" }))
    await user.click(screen.getByRole("button", { name: "Save Rating" }))

    await waitFor(() => {
      expect(mocks.saveRating).toHaveBeenCalledWith(
        "movie",
        123,
        8,
        "Spirited Away",
        "Sen to Chihiro no Kamikakushi",
        null,
        "2001-07-20",
        8.5,
      )
    })
  })
})
