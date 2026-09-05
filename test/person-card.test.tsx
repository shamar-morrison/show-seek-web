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

  it("keeps the actor name to a single line", () => {
    render(
      <PersonCard
        id={1}
        name="Brie Larson"
        profilePath="/profile.jpg"
        subtext="Captain Marvel"
      />,
    )

    expect(screen.getByText("Brie Larson").className).toContain("line-clamp-1")
  })
})
