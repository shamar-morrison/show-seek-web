import { render, screen } from "@/test/utils"
import { MediaPreviewContent } from "@/components/media-preview-content"
import type { UserList } from "@/types/list"
import type { TMDBMovieDetails } from "@/types/tmdb"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getNote: vi.fn(),
  getRating: vi.fn(),
  lists: [] as UserList[],
  preferences: {
    blurPlotSpoilers: false,
    showOriginalTitles: false,
  },
}))

vi.mock("@/hooks/use-lists", () => ({
  useLists: () => ({
    lists: mocks.lists,
  }),
}))

vi.mock("@/hooks/use-notes", () => ({
  useNotes: () => ({
    getNote: mocks.getNote,
  }),
}))

vi.mock("@/hooks/use-preferences", () => ({
  usePreferences: () => ({
    preferences: mocks.preferences,
  }),
}))

vi.mock("@/hooks/use-ratings", () => ({
  useRatings: () => ({
    getRating: mocks.getRating,
  }),
}))

vi.mock("@/components/rate-button", () => ({
  RateButton: () => <button type="button">Rate</button>,
}))

function createList(listId: string): UserList {
  return {
    id: listId,
    name: listId,
    items: {
      123: {
        id: 123,
        title: "Test Movie",
        poster_path: null,
        media_type: "movie",
        addedAt: 0,
      },
    },
    createdAt: 0,
    isCustom: listId === "road-trip",
  }
}

function createMovie(
  overrides: Partial<Pick<TMDBMovieDetails, "title" | "original_title">> = {},
): TMDBMovieDetails {
  return {
    id: 123,
    title: overrides.title ?? "Test Movie",
    original_title: overrides.original_title ?? "Test Movie",
    original_language: "en",
    overview: "Test overview",
    poster_path: null,
    backdrop_path: null,
    release_date: "",
    runtime: null,
    vote_average: 0,
    vote_count: 0,
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
    credits: {
      id: 123,
      cast: [],
      crew: [],
    },
  } as TMDBMovieDetails
}

describe("MediaPreviewContent add-to-list button", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.lists = []
    mocks.getRating.mockReturnValue(null)
    mocks.getNote.mockReturnValue(null)
  })

  it("renders the neutral plus button when the item is not in any list", () => {
    render(
      <MediaPreviewContent
        media={createMovie()}
        mediaType="movie"
        onAddToList={vi.fn()}
        onRate={vi.fn()}
        onNotes={vi.fn()}
      />,
    )

    const addButton = screen.getByRole("button", { name: "Add" })
    const icon = addButton.querySelector("[data-add-to-list-icon]")

    expect(icon).not.toBeNull()
    expect(icon).toHaveAttribute("data-add-to-list-icon", "plus")
    expect(addButton.className).not.toContain("border-blue-400/40")
    expect(addButton.className).not.toContain("border-green-400/40")
  })

  it("shows the watchlist icon and accent styling for a single matching list", () => {
    mocks.lists = [createList("watchlist")]

    render(
      <MediaPreviewContent
        media={createMovie()}
        mediaType="movie"
        onAddToList={vi.fn()}
        onRate={vi.fn()}
        onNotes={vi.fn()}
      />,
    )

    const addButton = screen.getByRole("button", { name: "Added" })
    const icon = addButton.querySelector("[data-add-to-list-icon]")

    expect(icon).not.toBeNull()
    expect(icon).toHaveAttribute("data-add-to-list-icon", "watchlist")
    expect(addButton.className).toContain("border-blue-400/40")
  })

  it("uses the multiple-lists fallback icon and styling when several lists match", () => {
    mocks.lists = [createList("watchlist"), createList("road-trip")]

    render(
      <MediaPreviewContent
        media={createMovie()}
        mediaType="movie"
        onAddToList={vi.fn()}
        onRate={vi.fn()}
        onNotes={vi.fn()}
      />,
    )

    const addButton = screen.getByRole("button", { name: "Added" })
    const icon = addButton.querySelector("[data-add-to-list-icon]")

    expect(icon).not.toBeNull()
    expect(icon).toHaveAttribute("data-add-to-list-icon", "multiple")
    expect(addButton.className).toContain("border-green-400/40")
  })

  it("prefers an explicit original-title override over the saved preference", () => {
    render(
      <MediaPreviewContent
        media={createMovie({
          title: "Spirited Away",
          original_title: "Sen to Chihiro no Kamikakushi",
        })}
        mediaType="movie"
        preferOriginalTitles={true}
        onAddToList={vi.fn()}
        onRate={vi.fn()}
        onNotes={vi.fn()}
      />,
    )

    expect(
      screen.getByRole("heading", {
        name: "Sen to Chihiro no Kamikakushi",
      }),
    ).toBeInTheDocument()
  })
})
