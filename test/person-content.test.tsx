import { PersonContent } from "@/components/person-content"
import { render, screen, within } from "@/test/utils"
import type {
  PersonCastMember,
  PersonCrewMember,
  TMDBPersonDetails,
} from "@/types/tmdb"
import userEvent from "@testing-library/user-event"
import { act } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  fetchTrailerKey: vi.fn(),
  preferences: {
    showOriginalTitles: false,
  },
  personImages: [] as Array<{
    aspect_ratio: number
    height: number
    iso_639_1: string | null
    file_path: string
    vote_average: number
    vote_count: number
    width: number
  }>,
  isPersonImagesLoading: false,
  isPersonImagesFetched: false,
  lightboxImages: null as null | Array<{ file_path: string }>,
  lightboxIndex: null as null | number,
  isLightboxOpen: false,
}))

vi.mock("@/app/actions", () => ({
  fetchTrailerKey: (...args: unknown[]) => mocks.fetchTrailerKey(...args),
}))

vi.mock("@/hooks/use-preferences", () => ({
  usePreferences: () => ({
    preferences: mocks.preferences,
  }),
}))

vi.mock("@/hooks/use-tmdb-queries", () => ({
  usePersonImages: () => ({
    data: mocks.personImages,
    isLoading: mocks.isPersonImagesLoading,
    isFetched: mocks.isPersonImagesFetched,
  }),
}))

vi.mock("@/components/photo-lightbox", () => ({
  PhotoLightbox: ({
    images,
    currentIndex,
    isOpen,
  }: {
    images: Array<{ file_path: string }>
    currentIndex: number
    isOpen: boolean
  }) => {
    mocks.lightboxImages = images
    mocks.lightboxIndex = currentIndex
    mocks.isLightboxOpen = isOpen
    return isOpen ? (
      <div data-testid="photo-lightbox" data-current-index={currentIndex}>
        Lightbox Open
      </div>
    ) : null
  },
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
    mocks.personImages = []
    mocks.isPersonImagesLoading = false
    mocks.isPersonImagesFetched = false
    mocks.lightboxImages = null
    mocks.lightboxIndex = null
    mocks.isLightboxOpen = false
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

  it("renders Photos tab and displays loading skeleton while photos are fetching", async () => {
    const user = userEvent.setup()
    mocks.isPersonImagesLoading = true
    mocks.isPersonImagesFetched = false

    render(<PersonContent person={createPerson()} />)

    const photosTabButton = screen.getByRole("button", { name: /^Photos$/i })
    expect(photosTabButton).toBeInTheDocument()
    // No count badge displayed while not fetched
    expect(photosTabButton).toHaveTextContent("Photos")

    await user.click(photosTabButton)

    expect(
      screen.getByTestId("photos-loading-skeleton"),
    ).toBeInTheDocument()
  })

  it("displays the count badge dynamically once photos finish fetching", () => {
    mocks.personImages = [
      {
        file_path: "/photo1.jpg",
        aspect_ratio: 0.667,
        height: 1500,
        width: 1000,
        iso_639_1: null,
        vote_average: 5,
        vote_count: 1,
      },
      {
        file_path: "/photo2.jpg",
        aspect_ratio: 0.667,
        height: 1500,
        width: 1000,
        iso_639_1: null,
        vote_average: 5,
        vote_count: 2,
      },
    ]
    mocks.isPersonImagesFetched = true
    mocks.isPersonImagesLoading = false

    render(<PersonContent person={createPerson()} />)

    const photosTabButton = screen.getByRole("button", { name: /Photos/i })
    expect(photosTabButton).toHaveTextContent(/Photos\s*2/)
  })

  it("renders photo grid and opens photo lightbox when a photo is clicked", async () => {
    const user = userEvent.setup()
    mocks.personImages = [
      {
        file_path: "/photo1.jpg",
        aspect_ratio: 0.667,
        height: 1500,
        width: 1000,
        iso_639_1: null,
        vote_average: 5,
        vote_count: 1,
      },
      {
        file_path: "/photo2.jpg",
        aspect_ratio: 0.667,
        height: 1500,
        width: 1000,
        iso_639_1: null,
        vote_average: 5,
        vote_count: 2,
      },
    ]
    mocks.isPersonImagesFetched = true
    mocks.isPersonImagesLoading = false

    render(<PersonContent person={createPerson({ name: "Hayao Miyazaki" })} />)

    await user.click(screen.getByRole("button", { name: /Photos/i }))

    const photoButtons = screen.getAllByRole("button", {
      name: /View photo/i,
    })
    expect(photoButtons).toHaveLength(2)

    const photo1Img = screen.getByAltText("Hayao Miyazaki photo 1")
    expect(photo1Img).toHaveAttribute(
      "src",
      expect.stringContaining("/photo1.jpg"),
    )

    // Click second photo
    await user.click(photoButtons[1])

    expect(screen.getByTestId("photo-lightbox")).toBeInTheDocument()
    expect(mocks.lightboxIndex).toBe(1)
    expect(mocks.isLightboxOpen).toBe(true)
    expect(mocks.lightboxImages?.map((img) => img.file_path)).toEqual([
      "/photo1.jpg",
      "/photo2.jpg",
    ])
  })

  it("falls back to person profile_path if photos array is empty", async () => {
    const user = userEvent.setup()
    mocks.personImages = []
    mocks.isPersonImagesFetched = true
    mocks.isPersonImagesLoading = false

    render(
      <PersonContent
        person={createPerson({
          name: "Hayao Miyazaki",
          profile_path: "/profile.jpg",
        })}
      />,
    )

    // Count badge should reflect fallback image (1)
    expect(screen.getByRole("button", { name: /Photos/i })).toHaveTextContent(
      /Photos\s*1/,
    )

    await user.click(screen.getByRole("button", { name: /Photos/i }))

    const photoButtons = screen.getAllByRole("button", {
      name: /View photo/i,
    })
    expect(photoButtons).toHaveLength(1)
    expect(screen.getByAltText("Hayao Miyazaki photo 1")).toHaveAttribute(
      "src",
      expect.stringContaining("/profile.jpg"),
    )

    await user.click(photoButtons[0])
    expect(mocks.isLightboxOpen).toBe(true)
    expect(mocks.lightboxIndex).toBe(0)
    expect(mocks.lightboxImages?.[0]?.file_path).toBe("/profile.jpg")
  })

  it("shows clean empty state message when no photos and no profile_path", async () => {
    const user = userEvent.setup()
    mocks.personImages = []
    mocks.isPersonImagesFetched = true
    mocks.isPersonImagesLoading = false

    render(
      <PersonContent
        person={createPerson({
          name: "Hayao Miyazaki",
          profile_path: null,
        })}
      />,
    )

    await user.click(screen.getByRole("button", { name: /Photos/i }))

    expect(
      screen.getByText("No photos found for Hayao Miyazaki."),
    ).toBeInTheDocument()
  })

  it("incrementally loads photos as the sentinel intersects", async () => {
    mocks.personImages = Array.from({ length: 45 }, (_, i) => ({
      file_path: `/photo-${i}.jpg`,
      aspect_ratio: 0.667,
      height: 1500,
      width: 1000,
      iso_639_1: null,
      vote_average: 5,
      vote_count: i,
    }))
    mocks.isPersonImagesFetched = true
    mocks.isPersonImagesLoading = false

    let observerCallback:
      | ((entries: Array<{ isIntersecting: boolean }>) => void)
      | null = null
    const originalObserver = window.IntersectionObserver

    class TestObserver {
      constructor(callback: (entries: Array<{ isIntersecting: boolean }>) => void) {
        observerCallback = callback
      }
      observe = vi.fn()
      disconnect = vi.fn()
      unobserve = vi.fn()
    }

    window.IntersectionObserver =
      TestObserver as unknown as typeof IntersectionObserver

    try {
      const user = userEvent.setup()
      render(<PersonContent person={createPerson()} />)

      await user.click(screen.getByRole("button", { name: /Photos/i }))

      // Initially rendered chunk is 30 photos
      expect(screen.getAllByRole("button", { name: /View photo/i })).toHaveLength(
        30,
      )
      expect(
        screen.getByTestId("photos-load-more-sentinel"),
      ).toHaveTextContent("Showing 30 of 45 — loading more…")

      // Trigger sentinel intersection
      await act(async () => {
        observerCallback?.([{ isIntersecting: true }])
      })

      // After intersecting, all 45 photos are loaded
      expect(screen.getAllByRole("button", { name: /View photo/i })).toHaveLength(
        45,
      )
      expect(
        screen.queryByTestId("photos-load-more-sentinel"),
      ).not.toBeInTheDocument()
    } finally {
      window.IntersectionObserver = originalObserver
    }
  })
})

