import type { ReactNode } from "react"

import type { TMDBPersonDetails } from "@/types/tmdb"
import { describe, expect, it, vi } from "vitest"

import { render, screen } from "./utils"

const getPersonDetailsMock = vi.fn()
const notFoundMock = vi.fn(() => {
  throw new Error("notFound")
})

vi.mock("next/navigation", () => ({
  notFound: () => notFoundMock(),
}))

vi.mock("@/components/person-credits-client", () => ({
  PersonCreditsClient: ({
    person,
    initialMediaType,
    initialCreditType,
  }: {
    person: TMDBPersonDetails
    initialMediaType: string
    initialCreditType: string
  }) => (
    <div>
      {person.name}:{initialMediaType}:{initialCreditType}
    </div>
  ),
}))

vi.mock("@/lib/tmdb", () => ({
  getPersonDetails: (...args: unknown[]) => getPersonDetailsMock(...args),
}))

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
  }: {
    href: string
    children?: ReactNode
  }) => <a href={href}>{children}</a>,
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

async function renderPersonCreditsPage(
  person: TMDBPersonDetails | null,
  searchParams: {
    mediaType?: string
    creditType?: string
  } = {},
) {
  getPersonDetailsMock.mockResolvedValue(person)

  const { default: PersonCreditsPage } = await import(
    "../app/person/[id]/credits/page"
  )
  const ui = await PersonCreditsPage({
    params: Promise.resolve({
      id: person ? String(person.id) : "1",
    }),
    searchParams: Promise.resolve(searchParams),
  })

  return render(ui)
}

describe("PersonCreditsPage", () => {
  it("passes valid query params through to the client component", async () => {
    await renderPersonCreditsPage(
      createPerson({
        combined_credits: {
          cast: [
            {
              id: 5,
              media_type: "movie",
              title: "Movie Credit",
              original_title: "Movie Credit",
              poster_path: "/movie.jpg",
              backdrop_path: null,
              release_date: "2020-01-01",
              first_air_date: undefined,
              character: "Lead",
              vote_average: 8,
              vote_count: 100,
              overview: "",
              adult: false,
              genre_ids: [18],
              popularity: 20,
            },
          ],
          crew: [
            {
              id: 10,
              media_type: "tv",
              title: undefined,
              original_title: undefined,
              name: "TV Crew Credit",
              original_name: "TV Crew Credit",
              poster_path: "/tv.jpg",
              backdrop_path: null,
              release_date: undefined,
              first_air_date: "2020-01-01",
              department: "Production",
              job: "Creator",
              vote_average: 8,
              vote_count: 100,
              overview: "",
              adult: false,
              genre_ids: [18],
              popularity: 10,
            },
          ],
        },
      }),
      {
        mediaType: "tv",
        creditType: "crew",
      },
    )

    expect(screen.getByText("Sample Person:tv:crew")).toBeInTheDocument()
  })

  it("defaults to the first available combination in fixed order when params are missing", async () => {
    await renderPersonCreditsPage(
      createPerson({
        combined_credits: {
          cast: [],
          crew: [
            {
              id: 10,
              media_type: "movie",
              title: "Directed Movie",
              original_title: "Directed Movie",
              poster_path: "/movie.jpg",
              backdrop_path: null,
              release_date: "2020-01-01",
              first_air_date: undefined,
              department: "Directing",
              job: "Director",
              vote_average: 8,
              vote_count: 100,
              overview: "",
              adult: false,
              genre_ids: [18],
              popularity: 10,
            },
          ],
        },
      }),
    )

    expect(screen.getByText("Sample Person:movie:crew")).toBeInTheDocument()
  })

  it("falls back to the first available combination when query params are invalid", async () => {
    await renderPersonCreditsPage(
      createPerson({
        combined_credits: {
          cast: [],
          crew: [
            {
              id: 10,
              media_type: "movie",
              title: "Directed Movie",
              original_title: "Directed Movie",
              poster_path: "/movie.jpg",
              backdrop_path: null,
              release_date: "2020-01-01",
              first_air_date: undefined,
              department: "Directing",
              job: "Director",
              vote_average: 8,
              vote_count: 100,
              overview: "",
              adult: false,
              genre_ids: [],
              popularity: 10,
            },
            {
              id: 20,
              media_type: "tv",
              title: undefined,
              original_title: undefined,
              name: "Acted TV Show",
              original_name: "Acted TV Show",
              poster_path: "/tv.jpg",
              backdrop_path: null,
              release_date: undefined,
              first_air_date: "2020-01-01",
              department: "Production",
              job: "Creator",
              vote_average: 8,
              vote_count: 100,
              overview: "",
              adult: false,
              genre_ids: [18],
              popularity: 10,
            },
          ],
        },
      }),
      {
        mediaType: "tv",
        creditType: "cast",
      },
    )

    expect(screen.getByText("Sample Person:movie:crew")).toBeInTheDocument()
  })

  it("calls notFound for invalid ids and missing people", async () => {
    const { default: PersonCreditsPage } = await import(
      "../app/person/[id]/credits/page"
    )

    await expect(
      PersonCreditsPage({
        params: Promise.resolve({ id: "abc" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("notFound")

    getPersonDetailsMock.mockResolvedValue(null)

    await expect(
      PersonCreditsPage({
        params: Promise.resolve({ id: "1" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("notFound")
  })
})
