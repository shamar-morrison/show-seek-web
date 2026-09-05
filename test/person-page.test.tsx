import type { ReactNode } from "react"

import type { TMDBPersonDetails } from "@/types/tmdb"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { render, screen } from "./utils"

const buildImageUrlMock = vi.fn()
const getPersonDetailsMock = vi.fn()
const notFoundMock = vi.fn(() => {
  throw new Error("notFound")
})

vi.mock("next/navigation", () => ({
  notFound: () => notFoundMock(),
}))

vi.mock("@/components/favorite-person-button", () => ({
  FavoritePersonButton: () => (
    <button type="button">favorite-person-button</button>
  ),
}))

vi.mock("@/components/page-container", () => ({
  PageContainer: ({
    children,
    className,
  }: {
    children?: ReactNode
    className?: string
  }) => <div className={className}>{children}</div>,
}))

vi.mock("@/components/person-biography", () => ({
  PersonBiography: () => <div>person-biography</div>,
}))

vi.mock("@/components/person-content", () => ({
  PersonContent: () => <div>person-content</div>,
}))

vi.mock("@/lib/tmdb", () => ({
  buildImageUrl: (...args: unknown[]) => buildImageUrlMock(...args),
  getPersonDetails: (...args: unknown[]) => getPersonDetailsMock(...args),
}))

function createPerson(
  overrides: Partial<TMDBPersonDetails> = {},
): TMDBPersonDetails {
  return {
    id: 1,
    name: "Sample Person",
    also_known_as: [],
    biography: "Biography",
    birthday: "1990-06-15",
    deathday: null,
    gender: 2,
    homepage: null,
    imdb_id: null,
    known_for_department: "Acting",
    place_of_birth: "Kingston, Jamaica",
    popularity: 1,
    profile_path: "/profile.jpg",
    adult: false,
    combined_credits: {
      cast: [],
      crew: [],
    },
    ...overrides,
  }
}

async function renderPersonPage(person: TMDBPersonDetails) {
  getPersonDetailsMock.mockResolvedValue(person)

  const { default: PersonPage } = await import("../app/person/[id]/page")
  const ui = await PersonPage({
    params: Promise.resolve({
      id: String(person.id),
    }),
  })

  return render(ui)
}

describe("PersonPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2024, 5, 20, 12, 0, 0))

    buildImageUrlMock.mockImplementation((path: string | null) =>
      path ? `https://image.tmdb.org/t/p/original${path}` : null,
    )
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("renders a non-sticky sidebar and living age copy", async () => {
    const { container } = await renderPersonPage(createPerson())

    expect(
      container.querySelector(".sticky.top-24"),
    ).not.toBeInTheDocument()
    expect(
      screen.getByText("June 15, 1990 (34 years old)"),
    ).toBeInTheDocument()
    expect(screen.getByText("person-content")).toBeInTheDocument()
  })

  it("renders age-at-death copy for deceased people", async () => {
    await renderPersonPage(
      createPerson({
        deathday: "2020-06-14",
      }),
    )

    expect(
      screen.getByText("June 15, 1990 (29 years old at death)"),
    ).toBeInTheDocument()
  })

  it("shows the date of death only for deceased people", async () => {
    await renderPersonPage(
      createPerson({
        deathday: "2020-06-14",
      }),
    )

    expect(screen.getByText("Date of Death")).toBeInTheDocument()
    expect(screen.getByText("June 14, 2020")).toBeInTheDocument()
  })

  it("hides the date of death for living people", async () => {
    await renderPersonPage(createPerson())

    expect(screen.queryByText("Date of Death")).not.toBeInTheDocument()
  })

  it("renders social links with exact profile urls", async () => {
    await renderPersonPage(
      createPerson({
        external_ids: {
          facebook_id: "somefb ",
          instagram_id: " someinsta",
          twitter_id: "sometw",
          tiktok_id: "@somett",
          youtube_id: "someyt",
        },
      }),
    )

    const row = screen.getByTestId("person-social-links")
    expect(row).toBeInTheDocument()

    const links = ["Instagram", "Twitter", "Facebook", "TikTok", "YouTube"].map(
      (label) => screen.getByRole("link", { name: label }),
    )
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "https://www.instagram.com/someinsta",
      "https://x.com/sometw",
      "https://www.facebook.com/somefb",
      "https://www.tiktok.com/@somett",
      "https://www.youtube.com/someyt",
    ])
    for (const link of links) {
      expect(link).toHaveAttribute("target", "_blank")
      expect(link.getAttribute("rel")).toContain("noopener")
    }
  })

  it("hides the social row when no external ids exist", async () => {
    await renderPersonPage(createPerson({ external_ids: null }))

    expect(
      screen.queryByTestId("person-social-links"),
    ).not.toBeInTheDocument()
  })
})
