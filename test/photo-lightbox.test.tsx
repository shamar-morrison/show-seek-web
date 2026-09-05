import { PhotoLightbox } from "@/components/photo-lightbox"
import { fireEvent, render, screen } from "@/test/utils"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/tmdb", () => ({
  buildImageUrl: (path: string | null) =>
    path ? `https://image.tmdb.org/t/p/w780${path}` : null,
}))

function createImage(filePath: string) {
  return {
    aspect_ratio: 0.666,
    height: 1500,
    iso_639_1: null as string | null,
    file_path: filePath,
    vote_average: 5,
    vote_count: 1,
    width: 1000,
  }
}

const IMAGES = [createImage("/a.jpg"), createImage("/b.jpg")]

describe("PhotoLightbox", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders nothing when closed", () => {
    const { container } = render(
      <PhotoLightbox
        images={IMAGES}
        currentIndex={0}
        isOpen={false}
        onClose={vi.fn()}
        onNavigate={vi.fn()}
      />,
    )

    expect(container).toBeEmptyDOMElement()
  })

  it("keeps the loading spinner square so it never morphs mid-spin", () => {
    render(
      <PhotoLightbox
        images={IMAGES}
        currentIndex={0}
        isOpen
        onClose={vi.fn()}
        onNavigate={vi.fn()}
      />,
    )

    // jsdom never fires img onLoad, so the spinner persists like a slow load
    const spinner = screen.getByTestId("photo-lightbox-spinner")
    expect(spinner.className).toContain("shrink-0")
    expect(spinner.className).toContain("aspect-square")
    expect(spinner.className).toContain("rounded-full")
    expect(spinner.className).toContain("animate-spin")
  })

  it("hides the spinner once the image loads and shows it again on navigate", () => {
    const onNavigate = vi.fn()

    render(
      <PhotoLightbox
        images={IMAGES}
        currentIndex={0}
        isOpen
        onClose={vi.fn()}
        onNavigate={onNavigate}
      />,
    )

    fireEvent.load(screen.getByAltText("Photo 1"))
    expect(
      screen.queryByTestId("photo-lightbox-spinner"),
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Next image" }))
    expect(onNavigate).toHaveBeenCalledWith(1)
  })
})
