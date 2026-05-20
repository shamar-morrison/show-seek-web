import { PersonCreditsClient } from "@/components/person-credits-client"
import { render, screen } from "@/test/utils"
import type {
  PersonCastMember,
  PersonCrewMember,
  TMDBPersonDetails,
} from "@/types/tmdb"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  fetchTrailerKey: vi.fn(),
  preferences: {
    showOriginalTitles: false,
  },
}))

let mockSearchParams = new URLSearchParams()

vi.mock("@/app/actions", () => ({
  fetchTrailerKey: (...args: unknown[]) => mocks.fetchTrailerKey(...args),
}))

vi.mock("@/hooks/use-preferences", () => ({
  usePreferences: () => ({
    preferences: mocks.preferences,
  }),
}))

vi.mock("next/navigation", () => ({
  useSearchParams: () => mockSearchParams,
}))

vi.mock("@/components/media-card-with-actions", () => ({
  MediaCardWithActions: ({
    media,
  }: {
    media: {
      title?: string
      name?: string
    }
  }) => <div data-testid="media-card">{media.title || media.name || "Unknown"}</div>,
}))

vi.mock("@/components/trailer-modal", () => ({
  TrailerModal: () => null,
}))

function createCastCredit(
  overrides: Partial<PersonCastMember> = {},
): PersonCastMember {
  return {
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
    ...overrides,
  }
}

function createCrewCredit(
  overrides: Partial<PersonCrewMember> = {},
): PersonCrewMember {
  return {
    id: 456,
    media_type: "movie",
    title: "Princess Mononoke",
    original_title: "Mononoke-hime",
    poster_path: "/crew-poster.jpg",
    backdrop_path: null,
    release_date: "1997-07-12",
    department: "Directing",
    job: "Director",
    vote_average: 8.4,
    vote_count: 100,
    overview: "",
    adult: false,
    genre_ids: [],
    popularity: 9,
    ...overrides,
  }
}

function createPerson(
  overrides: Partial<TMDBPersonDetails> = {},
): TMDBPersonDetails {
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
      cast: [createCastCredit()],
      crew: [createCrewCredit()],
    },
    ...overrides,
  }
}

function setLocation(search = "", pathname = "/person/1/credits") {
  window.history.replaceState({}, "", `${pathname}${search}`)
  mockSearchParams = new URLSearchParams(search)
}

describe("PersonCreditsClient", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.fetchTrailerKey.mockResolvedValue("abc123")
    setLocation()
  })

  it("restores the active combination from the URL and searches across original titles", async () => {
    const user = userEvent.setup()

    setLocation("?mediaType=movie&creditType=cast&q=Kamikakushi")

    render(<PersonCreditsClient person={createPerson()} />)

    const backLink = screen.getByRole("link", {
      name: /Back to Hayao Miyazaki/i,
    })

    expect(backLink).toHaveAttribute("href", "/person/1")
    expect(
      screen.getByRole("heading", { name: "Hayao Miyazaki Credits" }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /^Movies/i }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole("textbox")).toHaveValue("Kamikakushi")
    expect(screen.getByText("Spirited Away")).toBeInTheDocument()

    await user.clear(screen.getByRole("textbox"))

    expect(window.location.search).toBe("")
  })

  it("switches combinations, clears the search query, and updates the URL", async () => {
    const user = userEvent.setup()

    setLocation("?mediaType=movie&creditType=cast")

    render(
      <PersonCreditsClient
        person={createPerson({
          combined_credits: {
            cast: [
              createCastCredit({
                id: 100,
                title: "Movie Acting Credit",
                original_title: "Movie Acting Credit",
              }),
            ],
            crew: [
              createCrewCredit({
                id: 200,
                title: "Movie Crew Credit",
                original_title: "Movie Crew Credit",
              }),
              createCrewCredit({
                id: 201,
                media_type: "tv",
                title: undefined,
                original_title: undefined,
                name: "TV Crew Credit",
                original_name: "TV Crew Credit",
                release_date: undefined,
                first_air_date: "2021-01-01",
                job: "Creator",
                department: "Production",
              }),
            ],
          },
        })}
      />,
    )

    const searchInput = screen.getByRole("textbox", {
      name: /search by title or original title/i,
    })
    await user.type(searchInput, "Movie")
    expect(searchInput).toHaveValue("Movie")

    await user.click(
      screen.getByRole("button", { name: /TV Directed\/Written/i }),
    )

    expect(screen.getByText("TV Crew Credit")).toBeInTheDocument()
    expect(screen.queryByText("Movie Acting Credit")).not.toBeInTheDocument()
    expect(searchInput).toHaveValue("")
    expect(window.location.search).toBe("?mediaType=tv&creditType=crew")
  })

  it("hides the combination switcher when only one combination exists", () => {
    render(
      <PersonCreditsClient
        person={createPerson({
          combined_credits: {
            cast: [],
            crew: [
              createCrewCredit({
                id: 300,
                title: "Only Directed Movie",
                original_title: "Only Directed Movie",
              }),
            ],
          },
        })}
      />,
    )

    expect(
      screen.getByRole("heading", { name: "Hayao Miyazaki Credits" }),
    ).toBeInTheDocument()
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
    expect(screen.getByText("Only Directed Movie")).toBeInTheDocument()
  })
})
