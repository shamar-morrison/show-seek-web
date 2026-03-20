import { PersonContent } from "@/components/person-content"
import { render, screen, within } from "@/test/utils"
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
      id: number
      title?: string
      name?: string
      original_title?: string
      original_name?: string
      original_language: string
    }
    onWatchTrailer?: (media: unknown) => void
  }) => {
    const displayTitle = media.title || media.name || "Unknown"

    return (
      <div
        data-testid="media-card"
        data-original-language={media.original_language}
        data-title={displayTitle}
      >
        <div>{displayTitle}</div>
        <button type="button" onClick={() => onWatchTrailer?.(media)}>
          Watch trailer
        </button>
      </div>
    )
  },
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

function getMediaCard(title: string) {
  const titleNode = screen.getByText(title)
  const card = titleNode.closest('[data-testid="media-card"]')

  expect(card).not.toBeNull()

  return card as HTMLElement
}

describe("PersonContent", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.preferences.showOriginalTitles = false
    mocks.fetchTrailerKey.mockResolvedValue("abc123")
  })

  it("renders acting first for acting-known people and links each preview row to the drill-in page", async () => {
    const user = userEvent.setup()
    const person = createPerson({
      combined_credits: {
        cast: [
          createCastCredit({
            id: 100,
            title: "Spirited Away",
            original_title: "Sen to Chihiro no Kamikakushi",
            popularity: 40,
          }),
        ],
        crew: [
          createCrewCredit({
            id: 200,
            title: "Howl's Moving Castle",
            original_title: "Hauru no Ugoku Shiro",
            job: "Writer",
            department: "Writing",
            popularity: 60,
          }),
        ],
      },
    })
    const { rerender } = render(<PersonContent person={person} />)

    expect(
      screen.getByRole("button", { name: /Movies/i }),
    ).toHaveTextContent(/Movies\s*2/)
    expect(screen.getAllByRole("heading").map((node) => node.textContent)).toEqual(
      ["Acting (1)", "Directed/Written (1)"],
    )

    const viewAllLinks = screen.getAllByRole("link", { name: "View all" })
    expect(viewAllLinks[0]).toHaveAttribute(
      "href",
      "/person/1/credits?mediaType=movie&creditType=cast",
    )
    expect(viewAllLinks[1]).toHaveAttribute(
      "href",
      "/person/1/credits?mediaType=movie&creditType=crew",
    )

    expect(screen.getAllByTestId("media-card")[0]).toHaveAttribute(
      "data-original-language",
      "",
    )

    await user.click(
      within(getMediaCard("Spirited Away")).getByRole("button", {
        name: "Watch trailer",
      }),
    )

    expect(await screen.findByTestId("trailer-modal")).toHaveTextContent(
      "Spirited Away",
    )

    mocks.preferences.showOriginalTitles = true
    rerender(<PersonContent person={person} />)

    expect(screen.getByTestId("trailer-modal")).toHaveTextContent(
      "Sen to Chihiro no Kamikakushi",
    )
  })

  it("limits each preview row to fifteen cards", () => {
    render(
      <PersonContent
        person={createPerson({
          combined_credits: {
            cast: Array.from({ length: 16 }, (_, index) =>
              createCastCredit({
                id: 300 + index,
                title: `Acting Movie ${index}`,
                original_title: `Acting Movie ${index}`,
                popularity: 100 - index,
              }),
            ),
            crew: [],
          },
        })}
      />,
    )

    expect(
      screen.getByRole("button", { name: /Movies/i }),
    ).toHaveTextContent(/Movies\s*16/)
    expect(screen.getByText("Acting (16)")).toBeInTheDocument()
    expect(screen.queryByText("Acting Movie 15")).not.toBeInTheDocument()
    expect(screen.getAllByTestId("media-card")).toHaveLength(15)
  })

  it("uses union-based tab counts without double-counting dual-role titles", () => {
    render(
      <PersonContent
        person={createPerson({
          combined_credits: {
            cast: [
              createCastCredit({
                id: 400,
                title: "Dual Role Movie",
                original_title: "Dual Role Movie",
                popularity: 100,
              }),
              createCastCredit({
                id: 401,
                title: "Acting Only Movie",
                original_title: "Acting Only Movie",
                popularity: 90,
              }),
            ],
            crew: [
              createCrewCredit({
                id: 400,
                title: "Dual Role Movie",
                original_title: "Dual Role Movie",
                popularity: 95,
              }),
            ],
          },
        })}
      />,
    )

    expect(
      screen.getByRole("button", { name: /Movies/i }),
    ).toHaveTextContent(/Movies\s*2/)
    expect(screen.getByText("Acting (2)")).toBeInTheDocument()
    expect(screen.getByText("Directed/Written (1)")).toBeInTheDocument()
    expect(screen.getAllByText("Dual Role Movie")).toHaveLength(2)
  })

  it("shows the active tab empty state when no preview rows exist", async () => {
    const user = userEvent.setup()

    render(
      <PersonContent
        person={createPerson({
          combined_credits: {
            cast: [createCastCredit()],
            crew: [],
          },
        })}
      />,
    )

    await user.click(screen.getByRole("button", { name: /TV Shows/i }))

    expect(screen.getByText("No TV shows found.")).toBeInTheDocument()
    expect(
      screen.queryByRole("link", { name: "View all" }),
    ).not.toBeInTheDocument()
  })
})
