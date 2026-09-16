import { Footer } from "@/components/footer"
import { render, screen } from "@/test/utils"
import { describe, expect, it } from "vitest"
import PrivacyPage from "../app/privacy/page"
import TermsPage from "../app/terms/page"

describe("legal pages", () => {
  it("renders the on-site Terms of Service", () => {
    render(<TermsPage />)

    expect(
      screen.getByRole("heading", { name: "Terms of Service" }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Premium Subscriptions/)).toBeInTheDocument()
    const privacyLinks = screen.getAllByRole("link", { name: "Privacy Policy" })
    expect(privacyLinks.length).toBeGreaterThan(0)
    for (const link of privacyLinks) {
      expect(link).toHaveAttribute("href", "/privacy")
    }
  })

  it("renders the on-site Privacy Policy", () => {
    render(<PrivacyPage />)

    expect(
      screen.getByRole("heading", { name: "Privacy Policy" }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Data Sharing/)).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "Terms of Service" }),
    ).toHaveAttribute("href", "/terms")
  })

  it("links the footer to the on-site legal pages", () => {
    render(<Footer />)

    const terms = screen.getByRole("link", { name: "Terms of Service" })
    const privacy = screen.getByRole("link", { name: "Privacy Policy" })

    expect(terms).toHaveAttribute("href", "/terms")
    expect(privacy).toHaveAttribute("href", "/privacy")
    expect(terms).not.toHaveAttribute("target", "_blank")
    expect(privacy).not.toHaveAttribute("target", "_blank")
    expect(document.body.innerHTML).not.toContain("privacy-policies-psi")
  })
})
