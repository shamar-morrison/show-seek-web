import { Footer } from "@/components/footer"
import { DISCORD_INVITE_URL } from "@/lib/constants"
import { render, screen } from "@/test/utils"
import { describe, expect, it } from "vitest"

describe("Footer", () => {
  it("links to the Discord server below the tagline", () => {
    render(<Footer />)

    const link = screen.getByRole("link", { name: "Join our Discord" })

    expect(link).toHaveAttribute("href", DISCORD_INVITE_URL)
    expect(link).toHaveAttribute("target", "_blank")
  })
})
