import { CollectionProgressCard } from "@/components/collection-progress-card"
import { render, screen } from "@/test/utils"
import { describe, expect, it } from "vitest"

describe("CollectionProgressCard", () => {
  it("renders poster artwork when no backdrop is available", () => {
    render(
      <CollectionProgressCard
        collection={{
          collectionId: 90,
          name: "Dune Collection",
          posterPath: "/poster.jpg",
          backdropPath: null,
          watchedCount: 2,
          totalMovies: 3,
          percentage: 67,
          lastUpdated: 100,
        }}
      />,
    )

    expect(screen.getByAltText("Dune Collection")).toHaveAttribute(
      "src",
      expect.stringContaining("/poster.jpg"),
    )
  })
})
