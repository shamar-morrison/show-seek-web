import { PersonContent } from "@/components/person-content"
import { render, screen } from "@/test/utils"
import type { TMDBPersonDetails } from "@/types/tmdb"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  fetchTrailerKey: vi.fn(),
  preferences: {
    showOriginalTitles: false,
  },
}))

vi.mock("@/app/actions", () => ({
  fetchTrailerKey: (...args: unknown[]) => mocks.fetchTrailerKey(...args),
}))

vi.mock("@/hooks/use-preferences", () => ({
  usePreferences: () => ({
    preferences: mocks.preferences,
  }),
}))

vi.mock("@/components/media-card-with-actions", () => ({
  MediaCardWithActions: ({
    media,
    onWatchTrailer,
  }: {
    media: {
      title?: string
      name?: string
      original_title?: string
      original_name?: string
      original_language: string
    }
    onWatchTrailer?: (media: unknown) => void
  }) => (
    <div
      data-testid="media-card"
      data-original-language={media.original_language}
    >
      <button type="button" onClick={() => onWatchTrailer?.(media)}>
        Watch trailer
      </button>
    </div>
  ),
}))

vi.mock("@/components/trailer-modal", () => ({
  TrailerModal: ({
    isOpen,
    title,
    videoKey,
  }: {
    isOpen: boolean
    title: string
    videoKey: string | null
  }) =>
    isOpen ? (
      <div data-testid="trailer-modal" data-video-key={videoKey}>
        {title}
      </div>
    ) : null,
}))

function createPerson(): TMDBPersonDetails {
  return {
    id: 1,
    name: "Hayao Miyazaki",
    also_known_as: [],
    biography: "",
    birthday: null,
    deathday: null,
    gender: 2,
    homepage: null,
    imdb_id: null,
    known_for_department: "Acting",
    place_of_birth: null,
    popularity: 1,
    profile_path: null,
    adult: false,
    combined_credits: {
      cast: [
        {
          id: 123,
          media_type: "movie",
          title: "Spirited Away",
          original_title: "Sen to Chihiro no Kamikakushi",
          poster_path: "/poster.jpg",
          backdrop_path: null,
          release_date: "2001-07-20",
          character: "Role",
          vote_average: 8.5,
          vote_count: 100,
          overview: "",
          adult: false,
          genre_ids: [],
          popularity: 10,
        },
      ],
      crew: [],
    },
  }
}

describe("PersonContent", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.preferences.showOriginalTitles = false
    mocks.fetchTrailerKey.mockResolvedValue("abc123")
  })

  it("uses blank original language for mapped media and updates the trailer title when preferences change", async () => {
    const user = userEvent.setup()
    const { rerender } = render(<PersonContent person={createPerson()} />)

    expect(screen.getByTestId("media-card")).toHaveAttribute(
      "data-original-language",
      "",
    )

    await user.click(screen.getByRole("button", { name: "Watch trailer" }))

    const trailerModal = await screen.findByTestId("trailer-modal")

    expect(trailerModal).toHaveTextContent("Spirited Away")

    mocks.preferences.showOriginalTitles = true
    rerender(<PersonContent person={createPerson()} />)

    expect(screen.getByTestId("trailer-modal")).toHaveTextContent(
      "Sen to Chihiro no Kamikakushi",
    )
  })
})
