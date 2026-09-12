import { TraktReviewAvatar } from "@/components/trakt-review-avatar"
import { fireEvent, render, screen } from "@/test/utils"
import { describe, expect, it } from "vitest"

describe("TraktReviewAvatar", () => {
  it("shows the silhouette placeholder when no avatar URL exists", () => {
    render(<TraktReviewAvatar username="alice" avatarUrl={null} />)

    expect(
      screen.getByRole("img", { name: "alice placeholder avatar" }),
    ).toBeInTheDocument()
    expect(screen.queryByAltText("alice")).not.toBeInTheDocument()
  })

  it("renders the image when an avatar URL is provided", () => {
    render(
      <TraktReviewAvatar
        username="alice"
        avatarUrl="https://example.com/avatar.jpg"
      />,
    )

    expect(screen.getByAltText("alice")).toBeInTheDocument()
    expect(
      screen.queryByRole("img", { name: "alice placeholder avatar" }),
    ).not.toBeInTheDocument()
  })

  it("swaps a broken avatar URL to the silhouette placeholder", () => {
    render(
      <TraktReviewAvatar
        username="alice"
        avatarUrl="https://example.com/broken.jpg"
      />,
    )

    // Trakt often returns truthy avatar URLs that fail to load.
    fireEvent.error(screen.getByAltText("alice"))

    expect(
      screen.getByRole("img", { name: "alice placeholder avatar" }),
    ).toBeInTheDocument()
    expect(screen.queryByAltText("alice")).not.toBeInTheDocument()
  })

  it("retries loading when the avatar URL changes", () => {
    const { rerender } = render(
      <TraktReviewAvatar
        username="alice"
        avatarUrl="https://example.com/broken.jpg"
      />,
    )
    fireEvent.error(screen.getByAltText("alice"))
    expect(
      screen.getByRole("img", { name: "alice placeholder avatar" }),
    ).toBeInTheDocument()

    rerender(
      <TraktReviewAvatar
        username="alice"
        avatarUrl="https://example.com/fixed.jpg"
      />,
    )

    expect(screen.getByAltText("alice")).toBeInTheDocument()
  })
})
