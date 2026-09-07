import {
  UpNextEpisodeCard,
  shouldShowUpNextEpisode,
} from "@/components/up-next-episode-card"
import { render, screen } from "@/test/utils"
import { describe, expect, it } from "vitest"
import type { TMDBTVDetails } from "@/types/tmdb"

function createEpisode(
  overrides: Record<string, unknown> = {},
): NonNullable<TMDBTVDetails["next_episode_to_air"]> {
  return {
    id: 9001,
    name: "The Next Chapter",
    overview: "",
    air_date: "2026-02-01",
    episode_number: 3,
    episode_type: "standard",
    production_code: "",
    runtime: 45,
    season_number: 2,
    show_id: 777,
    still_path: "/still.jpg",
    vote_average: 0,
    vote_count: 0,
    ...overrides,
  } as NonNullable<TMDBTVDetails["next_episode_to_air"]>
}

function createShow(
  overrides: Record<string, unknown> = {},
): TMDBTVDetails {
  return {
    id: 777,
    status: "Returning Series",
    next_episode_to_air: createEpisode(),
    ...overrides,
  } as TMDBTVDetails
}

describe("UpNextEpisodeCard", () => {
  it("links to the episode page with season, title, and air date", () => {
    const { container } = render(
      <UpNextEpisodeCard tvShowId={777} episode={createEpisode()} />,
    )

    const link = screen.getByRole("link", { name: "Up Next: The Next Chapter" })

    expect(link).toHaveAttribute(
      "href",
      "/tv/777/season/2/episode/3",
    )
    expect(screen.getByText("Up Next")).toBeInTheDocument()
    expect(screen.getByText("The Next Chapter")).toBeInTheDocument()
    expect(screen.getByText(/S2E3/)).toBeInTheDocument()
    expect(container.querySelector("img")?.getAttribute("src")).toContain(
      "/still.jpg",
    )
  })

  it("shrink-wraps content and never truncates the title", () => {
    render(
      <UpNextEpisodeCard
        tvShowId={777}
        episode={createEpisode({
          name: "An Exceptionally Long Episode Title That Must Stay Visible",
        })}
      />,
    )

    const link = screen.getByRole("link", {
      name: "Up Next: An Exceptionally Long Episode Title That Must Stay Visible",
    })

    expect(link.className).toContain("w-fit")
    expect(link.className).not.toMatch(/(?:^|\s)w-full(?:\s|$)/)
    expect(
      screen.getByText(
        "An Exceptionally Long Episode Title That Must Stay Visible",
      ),
    ).not.toHaveClass("truncate")
  })

  it("shows a placeholder still when the episode has none and TBA without a date", () => {
    const { container } = render(
      <UpNextEpisodeCard
        tvShowId={777}
        episode={createEpisode({ still_path: null, air_date: null })}
      />,
    )

    expect(container.querySelector("img")).not.toBeInTheDocument()
    expect(screen.getByText("No Image")).toBeInTheDocument()
    expect(screen.getByText(/TBA/)).toBeInTheDocument()
  })
})

describe("shouldShowUpNextEpisode", () => {
  it("shows for ongoing shows with a valid next episode", () => {
    expect(shouldShowUpNextEpisode("tv", createShow())).toBe(true)
  })

  it("hides for ended shows, movies, or missing/invalid episodes", () => {
    expect(
      shouldShowUpNextEpisode("movie", createShow()),
    ).toBe(false)
    expect(
      shouldShowUpNextEpisode(
        "tv",
        createShow({ status: "Ended" }),
      ),
    ).toBe(false)
    expect(
      shouldShowUpNextEpisode("tv", createShow({ next_episode_to_air: null })),
    ).toBe(false)
    expect(
      shouldShowUpNextEpisode(
        "tv",
        createShow({
          next_episode_to_air: createEpisode({ episode_number: 0 }),
        }),
      ),
    ).toBe(false)
  })
})
