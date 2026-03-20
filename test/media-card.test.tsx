import { MediaCard } from "@/components/media-card"
import { render, screen } from "@/test/utils"
import type { TMDBMedia } from "@/types/tmdb"
import { describe, expect, it } from "vitest"

function createMedia(): TMDBMedia {
  return {
    id: 42,
    media_type: "movie",
    adult: false,
    backdrop_path: null,
    poster_path: null,
    title: "Spirited Away",
    original_title: "Sen to Chihiro no Kamikakushi",
    overview: "A young girl enters the spirit world.",
    genre_ids: [],
    popularity: 0,
    release_date: "2001-07-20",
    vote_average: 8.6,
    vote_count: 1000,
    original_language: "ja",
  }
}

function getRenderedListIndicatorIds(container: HTMLElement) {
  return Array.from(container.querySelectorAll("[data-list-indicator]")).map(
    (element) => element.getAttribute("data-list-indicator"),
  )
}

describe("MediaCard", () => {
  it("renders the localized title by default", () => {
    render(<MediaCard media={createMedia()} />)

    expect(
      screen.getByRole("heading", { name: "Spirited Away" }),
    ).toBeInTheDocument()
  })

  it("renders the original title when preferred", () => {
    render(<MediaCard media={createMedia()} preferOriginalTitles />)

    expect(
      screen.getByRole("heading", {
        name: "Sen to Chihiro no Kamikakushi",
      }),
    ).toBeInTheDocument()
  })

  it("collapses custom list membership into a single violet folder badge on the shared dark background", () => {
    const { container } = render(
      <MediaCard media={createMedia()} listIds={["road-trip"]} />,
    )

    const customBadge = container.querySelector(
      '[data-list-indicator="custom"]',
    )

    expect(getRenderedListIndicatorIds(container)).toEqual(["custom"])
    expect(customBadge).not.toBeNull()
    expect(customBadge?.className ?? "").toContain("bg-black/80")
    expect(customBadge?.querySelector("svg")?.getAttribute("class") ?? "").toContain(
      "text-violet-400",
    )
  })

  it("keeps default badges in canonical order and appends a single custom badge", () => {
    const { container } = render(
      <MediaCard
        media={createMedia()}
        listIds={["road-trip", "favorites", "watchlist"]}
      />,
    )

    expect(getRenderedListIndicatorIds(container)).toEqual([
      "watchlist",
      "favorites",
      "custom",
    ])
    expect(
      container.querySelectorAll('[data-list-indicator="watchlist"]').length,
    ).toBe(1)
    expect(
      container.querySelectorAll('[data-list-indicator="favorites"]').length,
    ).toBe(1)
    expect(
      container.querySelectorAll('[data-list-indicator="custom"]').length,
    ).toBe(1)
  })
})
