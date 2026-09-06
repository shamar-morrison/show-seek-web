import { ReviewModal } from "@/components/review-modal"
import { TraktReviewModal } from "@/components/trakt-review-modal"
import { fireEvent, render, screen } from "@/test/utils"
import type { TMDBReview } from "@/types/tmdb"
import type { TraktComment } from "@/types/trakt"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

function createTmdbReview(id: string, author: string): TMDBReview {
  return {
    id,
    author,
    author_details: {
      name: author,
      username: author.toLowerCase(),
      avatar_path: null,
      rating: 8,
    },
    content: `Review content by ${author}`,
    created_at: "2024-01-01",
    updated_at: "2024-01-01",
    url: `https://example.com/${id}`,
  }
}

function createTraktReview(id: number, username: string): TraktComment {
  return {
    id,
    parent_id: null,
    comment: `Trakt review by ${username}`,
    spoiler: false,
    review: true,
    replies: 0,
    likes: 0,
    created_at: "2024-01-01",
    updated_at: "2024-01-01",
    user: {
      username,
      private: false,
      name: username,
      vip: false,
      vip_ep: false,
      ids: { slug: username },
    },
    user_rating: 9,
  }
}

const TMDB_REVIEWS = [
  createTmdbReview("r1", "Alice"),
  createTmdbReview("r2", "Bob"),
  createTmdbReview("r3", "Cara"),
]
const TRAKT_REVIEWS = [
  createTraktReview(1, "alice"),
  createTraktReview(2, "bob"),
]

describe("ReviewModal", () => {
  it("shows the current review with a position counter", () => {
    render(
      <ReviewModal
        reviews={TMDB_REVIEWS}
        currentIndex={0}
        isOpen
        onClose={vi.fn()}
        onNavigate={vi.fn()}
      />,
    )

    expect(screen.getByText("Alice")).toBeInTheDocument()
    expect(screen.getByText("Review content by Alice")).toBeInTheDocument()
    expect(screen.getByText("1 / 3")).toBeInTheDocument()
  })

  it("pages with chevrons and disables them at the bounds", async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()

    const { rerender } = render(
      <ReviewModal
        reviews={TMDB_REVIEWS}
        currentIndex={0}
        isOpen
        onClose={vi.fn()}
        onNavigate={onNavigate}
      />,
    )

    expect(screen.getByRole("button", { name: "Previous review" }))
      .toBeDisabled()
    expect(screen.getByRole("button", { name: "Next review" })).toBeEnabled()

    // Chevrons live directly under the dialog panel (inside the portal,
    // outside the text column) and are desktop-only, so they never
    // obscure the review text.
    for (const name of ["Previous review", "Next review"] as const) {
      const chevron = screen.getByRole("button", { name })
      expect(
        chevron.closest('[data-slot="dialog-content"]'),
      ).not.toBeNull()
      expect(chevron.closest(".prose")).toBeNull()
      expect(chevron).toHaveClass("hidden")
    }

    await user.click(screen.getByRole("button", { name: "Next review" }))
    expect(onNavigate).toHaveBeenCalledWith(1)

    rerender(
      <ReviewModal
        reviews={TMDB_REVIEWS}
        currentIndex={2}
        isOpen
        onClose={vi.fn()}
        onNavigate={onNavigate}
      />,
    )

    expect(screen.getByText("3 / 3")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Next review" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Previous review" }))
      .toBeEnabled()

    await user.click(screen.getByRole("button", { name: "Previous review" }))
    expect(onNavigate).toHaveBeenCalledWith(1)
  })

  it("pages with arrow keys and ignores them at the bounds", () => {
    const onNavigate = vi.fn()

    render(
      <ReviewModal
        reviews={TMDB_REVIEWS}
        currentIndex={1}
        isOpen
        onClose={vi.fn()}
        onNavigate={onNavigate}
      />,
    )

    fireEvent.keyDown(document, { key: "ArrowRight" })
    expect(onNavigate).toHaveBeenCalledWith(2)

    fireEvent.keyDown(document, { key: "ArrowLeft" })
    expect(onNavigate).toHaveBeenCalledWith(0)
  })

  it("does not page past the first or last review via keyboard", () => {
    const onNavigate = vi.fn()

    const { rerender } = render(
      <ReviewModal
        reviews={TMDB_REVIEWS}
        currentIndex={0}
        isOpen
        onClose={vi.fn()}
        onNavigate={onNavigate}
      />,
    )

    fireEvent.keyDown(document, { key: "ArrowLeft" })
    expect(onNavigate).not.toHaveBeenCalled()

    rerender(
      <ReviewModal
        reviews={TMDB_REVIEWS}
        currentIndex={2}
        isOpen
        onClose={vi.fn()}
        onNavigate={onNavigate}
      />,
    )

    fireEvent.keyDown(document, { key: "ArrowRight" })
    expect(onNavigate).not.toHaveBeenCalled()
  })

  it("hides chevrons and counter for a single review", () => {
    render(
      <ReviewModal
        reviews={[TMDB_REVIEWS[0]]}
        currentIndex={0}
        isOpen
        onClose={vi.fn()}
        onNavigate={vi.fn()}
      />,
    )

    expect(
      screen.queryByRole("button", { name: "Previous review" }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Next review" }),
    ).not.toBeInTheDocument()
    expect(screen.queryByText("1 / 1")).not.toBeInTheDocument()
  })
})

describe("TraktReviewModal", () => {
  it("shows the current review with a position counter", () => {
    render(
      <TraktReviewModal
        reviews={TRAKT_REVIEWS}
        currentIndex={1}
        isOpen
        onClose={vi.fn()}
        onNavigate={vi.fn()}
      />,
    )

    expect(screen.getByText("bob")).toBeInTheDocument()
    expect(screen.getByText("2 / 2")).toBeInTheDocument()
  })

  it("pages with chevrons and arrow keys", async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()

    render(
      <TraktReviewModal
        reviews={TRAKT_REVIEWS}
        currentIndex={0}
        isOpen
        onClose={vi.fn()}
        onNavigate={onNavigate}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Next review" }))
    expect(onNavigate).toHaveBeenCalledWith(1)

    fireEvent.keyDown(document, { key: "ArrowRight" })
    expect(onNavigate).toHaveBeenCalledTimes(2)

    fireEvent.keyDown(document, { key: "ArrowLeft" })
    expect(onNavigate).not.toHaveBeenCalledTimes(3)
  })
})
