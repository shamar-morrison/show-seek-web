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
  PersonCreditsClient: ({ person }: { person: TMDBPersonDetails }) => (
    <div>{person.name}</div>
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

async function renderPersonCreditsPage(person: TMDBPersonDetails | null) {
  getPersonDetailsMock.mockResolvedValue(person)

  const { default: PersonCreditsPage } = await import(
    "../app/person/[id]/credits/page"
  )
  const ui = await PersonCreditsPage({
    params: Promise.resolve({
      id: person ? String(person.id) : "1",
    }),
  })

  return render(ui)
}

describe("PersonCreditsPage", () => {
  it("renders the client component with the fetched person", async () => {
    await renderPersonCreditsPage(createPerson())

    expect(screen.getByText("Sample Person")).toBeInTheDocument()
  })

  it("calls notFound for invalid ids and missing people", async () => {
    const { default: PersonCreditsPage } = await import(
      "../app/person/[id]/credits/page"
    )

    await expect(
      PersonCreditsPage({
        params: Promise.resolve({ id: "abc" }),
      }),
    ).rejects.toThrow("notFound")

    getPersonDetailsMock.mockResolvedValue(null)

    await expect(
      PersonCreditsPage({
        params: Promise.resolve({ id: "1" }),
      }),
    ).rejects.toThrow("notFound")
  })
})
