import { PersonCard } from "@/components/person-card"
import { render, screen } from "@/test/utils"
import { describe, expect, it } from "vitest"

describe("PersonCard", () => {
  it("wraps long character names over two lines with uniform height", () => {
    render(
      <PersonCard
        id={1}
        name="Brie Larson"
        profilePath="/profile.jpg"
        subtext="Captain Marvel / Carol Danvers"
      />,
    )

    const character = screen.getByText("Captain Marvel / Carol Danvers")
    expect(character.className).toContain("line-clamp-2")
    expect(character.className).toContain("min-h-8")
    expect(character.className).not.toContain("line-clamp-1")
  })

  it("wraps the actor name over two lines without reserving empty space", () => {
    render(
      <PersonCard
        id={1}
        name="Brie Larson"
        profilePath="/profile.jpg"
        subtext="Captain Marvel"
      />,
    )

    const heading = screen.getByText("Brie Larson")
    expect(heading.className).toContain("line-clamp-2")
    expect(heading.className).not.toContain("line-clamp-1")
    expect(heading.className).not.toContain("min-h-10")
  })
})
