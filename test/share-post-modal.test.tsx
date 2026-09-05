import { SharePostModal } from "@/components/share-post-modal"
import { render, screen, waitFor } from "@/test/utils"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  canvasToPngBlob: vi.fn(),
  copyPngToClipboard: vi.fn(),
  copyTextToClipboard: vi.fn(),
  downloadPng: vi.fn(),
  renderShareCard: vi.fn(),
  toastError: vi.fn(),
  toastInfo: vi.fn(),
  toastSuccess: vi.fn(),
}))

vi.mock("@/lib/share-post", () => ({
  canvasToPngBlob: (...args: unknown[]) => mocks.canvasToPngBlob(...args),
  copyPngToClipboard: (...args: unknown[]) =>
    mocks.copyPngToClipboard(...args),
  copyTextToClipboard: (...args: unknown[]) =>
    mocks.copyTextToClipboard(...args),
  downloadPng: (...args: unknown[]) => mocks.downloadPng(...args),
  getSharePostFilename: () => "showseek-movie-123.png",
  renderShareCard: (...args: unknown[]) => mocks.renderShareCard(...args),
}))

vi.mock("@/components/ui/base-media-modal", () => ({
  BaseMediaModal: ({
    children,
    isOpen,
    title,
  }: {
    children: ReactNode
    isOpen: boolean
    title: string
  }) =>
    isOpen ? (
      <div>
        <h1>{title}</h1>
        {children}
      </div>
    ) : null,
}))

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => mocks.toastSuccess(...args),
    error: (...args: unknown[]) => mocks.toastError(...args),
    info: (...args: unknown[]) => mocks.toastInfo(...args),
  },
}))

const MEDIA = {
  id: 123,
  mediaType: "movie" as const,
  title: "Inception",
  posterUrl: null,
  backdropUrl: null,
  releaseYear: "2010",
  genres: ["Sci-Fi"],
  userRating: 9,
}
const CAPTION = "Check out Inception (2010) on ShowSeek! My rating: 9/10."

describe("SharePostModal", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.renderShareCard.mockResolvedValue({})
    mocks.canvasToPngBlob.mockResolvedValue(
      new Blob(["png"], { type: "image/png" }),
    )
    mocks.copyPngToClipboard.mockResolvedValue(undefined)
    mocks.copyTextToClipboard.mockResolvedValue(undefined)
  })

  it("generates and previews the share image on open", async () => {
    render(<SharePostModal isOpen onClose={vi.fn()} media={MEDIA} caption={CAPTION} />)

    expect(screen.getByText("Generating image...")).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByTestId("share-post-preview")).toBeInTheDocument()
    })
    expect(mocks.renderShareCard).toHaveBeenCalledWith(MEDIA)
    expect(screen.getByTestId("share-post-caption")).toHaveTextContent(CAPTION)
  })

  it("copies the image and shows a success toast", async () => {
    const user = userEvent.setup()

    render(<SharePostModal isOpen onClose={vi.fn()} media={MEDIA} caption={CAPTION} />)

    await waitFor(() => {
      expect(screen.getByTestId("share-post-preview")).toBeInTheDocument()
    })

    await user.click(screen.getByTestId("share-post-copy-image"))

    await waitFor(() => {
      expect(mocks.copyPngToClipboard).toHaveBeenCalledTimes(1)
    })
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Image copied to clipboard")
  })

  it("downloads the image when clipboard copy is unsupported", async () => {
    const user = userEvent.setup()
    mocks.copyPngToClipboard.mockRejectedValueOnce(
      new Error("Image clipboard is not supported in this browser"),
    )

    render(<SharePostModal isOpen onClose={vi.fn()} media={MEDIA} caption={CAPTION} />)

    await waitFor(() => {
      expect(screen.getByTestId("share-post-preview")).toBeInTheDocument()
    })

    await user.click(screen.getByTestId("share-post-copy-image"))

    await waitFor(() => {
      expect(mocks.downloadPng).toHaveBeenCalledTimes(1)
    })
    expect(mocks.toastInfo).toHaveBeenCalledWith(
      "Image copy not supported here — downloaded instead",
    )
  })

  it("copies the caption and downloads on demand", async () => {
    const user = userEvent.setup()

    render(<SharePostModal isOpen onClose={vi.fn()} media={MEDIA} caption={CAPTION} />)

    await waitFor(() => {
      expect(screen.getByTestId("share-post-preview")).toBeInTheDocument()
    })

    await user.click(screen.getByTestId("share-post-copy-caption"))

    await waitFor(() => {
      expect(mocks.copyTextToClipboard).toHaveBeenCalledWith(CAPTION)
    })
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Caption copied to clipboard")

    await user.click(screen.getByTestId("share-post-download"))

    expect(mocks.downloadPng).toHaveBeenCalledTimes(1)
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Image downloaded")
  })
})
