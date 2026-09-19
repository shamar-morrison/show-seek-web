import { render, screen } from "@/test/utils"
import { MediaPreviewContent } from "@/components/media-preview-content"
import type { UserList } from "@/types/list"
import type { TMDBMovieDetails, TMDBTVDetails } from "@/types/tmdb"
import userEvent from "@testing-library/user-event"
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
    expect(addButton.className).not.toContain("border-blue-500/50")
    expect(addButton.className).not.toContain("border-[#46D369]/50")
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
    expect(addButton.className).toContain("border-blue-500/50")
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
    expect(addButton.className).toContain("border-[#46D369]/50")
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

function createTVShow(): TMDBTVDetails {
  return {
    id: 456,
    name: "Signal Run",
    original_name: "Signal Run",
    original_language: "en",
    overview: "Test overview",
    poster_path: null,
    backdrop_path: null,
    first_air_date: "2024-01-01",
    vote_average: 8,
    vote_count: 10,
    genres: [],
    status: "Returning Series",
    number_of_episodes: 4,
    number_of_seasons: 1,
    seasons: [],
    episode_run_time: [],
    created_by: [],
  } as unknown as TMDBTVDetails
}

function createTVTrigger(
  overrides: Partial<{
    visible: boolean
    label: string
    isShowFullyWatched: boolean
    fillRatio: number
    isPending: boolean
    isLoading: boolean
    isError: boolean
  }> = {},
) {
  return {
    visible: true,
    label: "Mark as Watched",
    isShowFullyWatched: false,
    fillRatio: 0,
    isPending: false,
    isLoading: false,
    isError: false,
    ...overrides,
  }
}

describe("MediaPreviewContent TV watch trigger", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.lists = []
    mocks.getRating.mockReturnValue(null)
    mocks.getNote.mockReturnValue(null)
  })

  it("renders a trigger-only TV button without owning any dialogs", () => {
    render(
      <MediaPreviewContent
        media={createTVShow()}
        mediaType="tv"
        onAddToList={vi.fn()}
        onRate={vi.fn()}
        onNotes={vi.fn()}
        tvWatchTrigger={createTVTrigger()}
        onTvWatchClick={vi.fn()}
      />,
    )

    // Trigger renders inline; no confirm dialog is owned by the content, so
    // closing the hover preview cannot unmount the dialog flow.
    expect(
      screen.getByTestId("tv-show-watch-button"),
    ).toHaveTextContent("Mark as Watched")
    expect(
      screen.queryByText("Mark All Episodes Watched?"),
    ).not.toBeInTheDocument()
  })

  it("delegates the TV click to the parent instead of opening a dialog itself", async () => {
    const user = userEvent.setup()
    const onTvWatchClick = vi.fn()
    render(
      <MediaPreviewContent
        media={createTVShow()}
        mediaType="tv"
        onAddToList={vi.fn()}
        onRate={vi.fn()}
        onNotes={vi.fn()}
        tvWatchTrigger={createTVTrigger({ label: "1/4 Episodes Watched" })}
        onTvWatchClick={onTvWatchClick}
      />,
    )

    await user.click(screen.getByTestId("tv-show-watch-button"))

    expect(onTvWatchClick).toHaveBeenCalledTimes(1)
    // Still no dialog owned here - the parent mounts it outside the popup.
    expect(
      screen.queryByText("Mark All Episodes Watched?"),
    ).not.toBeInTheDocument()
  })

  it("renders retry state and delegates retry to the parent", async () => {
    const user = userEvent.setup()
    const onTvRetryWatchStatus = vi.fn()
    render(
      <MediaPreviewContent
        media={createTVShow()}
        mediaType="tv"
        onAddToList={vi.fn()}
        onRate={vi.fn()}
        onNotes={vi.fn()}
        tvWatchTrigger={createTVTrigger({ isError: true })}
        onTvRetryWatchStatus={onTvRetryWatchStatus}
      />,
    )

    await user.click(screen.getByTestId("tv-show-watch-button-retry"))

    expect(onTvRetryWatchStatus).toHaveBeenCalledTimes(1)
  })

  it("renders no TV button when the trigger is not visible", () => {
    render(
      <MediaPreviewContent
        media={createTVShow()}
        mediaType="tv"
        onAddToList={vi.fn()}
        onRate={vi.fn()}
        onNotes={vi.fn()}
        tvWatchTrigger={createTVTrigger({ visible: false })}
        onTvWatchClick={vi.fn()}
      />,
    )

    expect(
      screen.queryByTestId("tv-show-watch-button"),
    ).not.toBeInTheDocument()
  })
})
