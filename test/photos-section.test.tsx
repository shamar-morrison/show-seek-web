import { PhotosSection } from "@/components/photos-section"
import { render, screen } from "@/test/utils"
import type { ReactNode } from "react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  images: [] as Array<{
    aspect_ratio: number
    height: number
    iso_639_1: string | null
    file_path: string
    vote_average: number
    vote_count: number
    width: number
  }>,
  lightboxImages: null as null | Array<{ file_path: string }>,
  region: "US",
}))

vi.mock("@/components/photo-lightbox", () => ({
  PhotoLightbox: ({
    images,
  }: {
    images: Array<{ file_path: string }>
  }) => {
    mocks.lightboxImages = images
    return null
  },
}))

vi.mock("@/components/ui/scrollable-row", () => ({
  ScrollableRow: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}))

vi.mock("@/components/ui/section-skeleton", () => ({
  SectionSkeleton: () => <div>skeleton</div>,
}))

vi.mock("@/hooks/use-intersection-observer", () => ({
  useIntersectionObserver: () => ({ ref: vi.fn() }),
}))

vi.mock("@/hooks/use-preferences", () => ({
  usePreferences: () => ({
    region: mocks.region,
  }),
}))

vi.mock("@/hooks/use-tmdb-queries", () => ({
  useMediaImages: () => ({
    data: mocks.images,
    isLoading: false,
    isFetched: true,
  }),
}))

function makeImage(filePath: string, iso6391: string | null) {
  return {
    aspect_ratio: 0.666,
    height: 1500,
    iso_639_1: iso6391,
    file_path: filePath,
    vote_average: 5,
    vote_count: 1,
    width: 1000,
  }
}

describe("PhotosSection region filtering", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.region = "US"
    mocks.lightboxImages = null
    mocks.images = [
      makeImage("/en.jpg", "en"),
      makeImage("/fr.jpg", "fr"),
      makeImage("/neutral.jpg", null),
    ]
  })

  it("hides non-matching posters and backdrops but keeps neutral ones", () => {
    render(<PhotosSection mediaId={1} mediaType="movie" />)

    expect(screen.getByAltText("Photo 1")).toHaveAttribute(
      "src",
      expect.stringContaining("/en.jpg"),
    )
    expect(screen.getByAltText("Photo 2")).toHaveAttribute(
      "src",
      expect.stringContaining("/neutral.jpg"),
    )
    expect(screen.queryByText("Photo 3")).not.toBeInTheDocument()
    expect(mocks.lightboxImages?.map((image) => image.file_path)).toEqual([
      "/en.jpg",
      "/neutral.jpg",
    ])
  })

  it("reveals all photos through the show-all toggle", async () => {
    const user = userEvent.setup()

    render(<PhotosSection mediaId={1} mediaType="movie" />)

    await user.click(screen.getByTestId("photos-show-all"))

    expect(screen.getByAltText("Photo 2")).toHaveAttribute(
      "src",
      expect.stringContaining("/fr.jpg"),
    )
    expect(mocks.lightboxImages).toHaveLength(3)

    await user.click(screen.getByTestId("photos-show-matching"))

    expect(screen.queryByText("Photo 3")).not.toBeInTheDocument()
  })

  it("shows a region empty state when nothing matches", async () => {
    const user = userEvent.setup()
    mocks.region = "JP"
    mocks.images = [makeImage("/fr.jpg", "fr")]

    render(<PhotosSection mediaId={1} mediaType="movie" />)

    expect(screen.getByTestId("photos-region-empty")).toBeInTheDocument()

    await user.click(screen.getByTestId("photos-show-all-empty"))

    expect(screen.getByAltText("Photo 1")).toHaveAttribute(
      "src",
      expect.stringContaining("/fr.jpg"),
    )
  })
})
