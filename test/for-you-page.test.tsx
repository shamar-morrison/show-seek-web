import ForYouPage from "@/app/for-you/page"
import { render, screen } from "@/test/utils"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  sections: [] as Array<{
    seed: { id: number; mediaType: "movie" | "tv"; title: string }
    recommendations: unknown[]
    isLoading: boolean
  }>,
}))

vi.mock("@/hooks/use-for-you-recommendations", () => ({
  useForYouRecommendations: () => ({
    sections: mocks.sections,
    hiddenGems: [],
    trendingMovies: [],
    isLoading: false,
    isAuthLoading: false,
    hasNoQualifyingRatings: false,
    needsFallback: false,
    isGuest: false,
  }),
}))

vi.mock("@/components/media-card-with-actions", () => ({
  MediaCardWithActions: () => <div>media-card</div>,
}))

vi.mock("@/components/ui/scrollable-row", () => ({
  ScrollableRow: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}))

vi.mock("@/components/ui/section", () => ({
  Section: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: () => <div>skeleton</div>,
}))

describe("ForYouPage seed titles", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.sections = [
      {
        seed: { id: 123, mediaType: "movie", title: "Inception" },
        recommendations: [],
        isLoading: false,
      },
      {
        seed: { id: 456, mediaType: "tv", title: "Severance" },
        recommendations: [],
        isLoading: false,
      },
    ]
  })

  it("links movie seed titles to the movie details page", () => {
    render(<ForYouPage />)

    expect(screen.getByRole("link", { name: "Inception" })).toHaveAttribute(
      "href",
      "/movie/123",
    )
  })

  it("links tv seed titles to the tv details page", () => {
    render(<ForYouPage />)

    expect(screen.getByRole("link", { name: "Severance" })).toHaveAttribute(
      "href",
      "/tv/456",
    )
  })
})
