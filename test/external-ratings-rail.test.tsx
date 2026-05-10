import { ExternalRatingsRail } from "@/components/external-ratings-rail"
import { render, screen } from "@/test/utils"
import type { ExternalRatings } from "@/types/external-ratings"
import { describe, expect, it } from "vitest"

function createRatings(
  overrides: Partial<ExternalRatings> = {},
): ExternalRatings {
  return {
    imdb: { rating: "8.7", votes: "1,234,567" },
    rottenTomatoes: "91%",
    metacritic: "76/100",
    ...overrides,
  }
}

describe("ExternalRatingsRail", () => {
  it("renders all available external ratings with their source labels", () => {
    const { container } = render(
      <ExternalRatingsRail ratings={createRatings()} />,
    )

    expect(screen.getByTestId("external-ratings-rail")).toBeInTheDocument()
    expect(screen.getByText("8.7/10")).toBeInTheDocument()
    expect(screen.getByText("91%")).toBeInTheDocument()
    expect(screen.getByText("76/100")).toBeInTheDocument()
    expect(screen.getByText("IMDb")).toBeInTheDocument()
    expect(screen.getByText("Rotten Tomatoes")).toBeInTheDocument()
    expect(screen.getByText("Metacritic")).toBeInTheDocument()

    const imageSources = Array.from(container.querySelectorAll("img")).map(
      (image) => image.getAttribute("src"),
    )

    expect(imageSources).toEqual([
      "/imdb-logo.png",
      "/rotten-tomatoes-logo.png",
      "/metacritic-logo.png",
    ])
  })

  it("renders only the sources that have values", () => {
    const { container } = render(
      <ExternalRatingsRail
        ratings={createRatings({
          rottenTomatoes: null,
        })}
      />,
    )

    expect(screen.getByText("8.7/10")).toBeInTheDocument()
    expect(screen.getByText("76/100")).toBeInTheDocument()
    expect(screen.queryByText("91%")).not.toBeInTheDocument()
    expect(screen.queryByText("Rotten Tomatoes")).not.toBeInTheDocument()
    expect(container.querySelectorAll("img")).toHaveLength(2)
  })

  it("hides the rail when no ratings are available", () => {
    const { container, rerender } = render(<ExternalRatingsRail ratings={null} />)

    expect(
      screen.queryByTestId("external-ratings-rail"),
    ).not.toBeInTheDocument()

    rerender(
      <ExternalRatingsRail
        ratings={{
          imdb: null,
          rottenTomatoes: null,
          metacritic: null,
        }}
      />,
    )

    expect(container).toBeEmptyDOMElement()
  })
})
