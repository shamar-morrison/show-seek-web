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
})
