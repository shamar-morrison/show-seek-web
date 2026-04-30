import { PosterPickerModal } from "@/components/poster-picker-modal"
import { render, screen, waitFor } from "@/test/utils"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  clearPosterOverride: vi.fn(),
  refetch: vi.fn(),
  resolvePosterPath: vi.fn(
    (
      _mediaType: "movie" | "tv",
      _mediaId: number,
      fallbackPosterPath: string | null,
    ) => fallbackPosterPath,
  ),
  setPosterOverride: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  useMediaImageCatalog: vi.fn(),
}))

vi.mock("@/hooks/use-preferences", () => ({
  usePreferences: () => ({
    setPosterOverride: mocks.setPosterOverride,
    clearPosterOverride: mocks.clearPosterOverride,
  }),
}))

vi.mock("@/hooks/use-poster-overrides", () => ({
  usePosterOverrides: () => ({
    resolvePosterPath: mocks.resolvePosterPath,
  }),
}))

vi.mock("@/hooks/use-tmdb-queries", () => ({
  useMediaImageCatalog: (
    mediaId: number,
    mediaType: "movie" | "tv",
    enabled: boolean,
  ) => mocks.useMediaImageCatalog(mediaId, mediaType, enabled),
}))

vi.mock("@/components/ui/base-media-modal", () => ({
  BaseMediaModal: ({
    children,
    title,
    description,
  }: {
    children: React.ReactNode
    title: string
    description?: string
  }) => (
    <div>
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
      {children}
    </div>
  ),
}))

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => mocks.toastSuccess(...args),
    error: (...args: unknown[]) => mocks.toastError(...args),
  },
}))

function createImagesResponse() {
  return {
    id: 123,
    backdrops: [],
    logos: [],
    posters: [
      {
        aspect_ratio: 0.666,
        height: 1500,
        iso_639_1: "en",
        file_path: "/poster-a.jpg",
        vote_average: 5,
        vote_count: 1,
        width: 1000,
      },
      {
        aspect_ratio: 0.666,
        height: 1500,
        iso_639_1: "en",
        file_path: "/poster-a.jpg",
        vote_average: 5,
        vote_count: 1,
        width: 1000,
      },
      {
        aspect_ratio: 0.666,
        height: 1500,
        iso_639_1: null,
        file_path: "/poster-b.jpg",
        vote_average: 4,
        vote_count: 1,
        width: 1000,
      },
    ],
  }
}

describe("PosterPickerModal", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.clearPosterOverride.mockResolvedValue(undefined)
    mocks.refetch.mockResolvedValue(undefined)
    mocks.resolvePosterPath.mockImplementation(
      (
        _mediaType: "movie" | "tv",
        _mediaId: number,
        fallbackPosterPath: string | null,
      ) => fallbackPosterPath,
    )
    mocks.setPosterOverride.mockResolvedValue(undefined)
    mocks.useMediaImageCatalog.mockReturnValue({
      data: createImagesResponse(),
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: mocks.refetch,
    })
  })

  it("dedupes posters, preselects the active override, and disables save until changed", async () => {
    mocks.resolvePosterPath.mockReturnValue("/poster-b.jpg")

    render(
      <PosterPickerModal
        isOpen
        onClose={vi.fn()}
        mediaId={123}
        mediaType="movie"
        title="Spirited Away"
        defaultPosterPath="/poster-a.jpg"
      />,
    )

    expect(
      screen.getByTestId("poster-picker-option-/poster-b.jpg"),
    ).toHaveAttribute("aria-pressed", "true")
    expect(
      screen.getAllByTestId(/poster-picker-option-/),
    ).toHaveLength(2)
    expect(
      screen.getByTestId("poster-picker-save-button"),
    ).toBeDisabled()
  })

  it("clears the override when the user switches back to the default poster", async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()

    mocks.resolvePosterPath.mockReturnValue("/poster-b.jpg")

    render(
      <PosterPickerModal
        isOpen
        onClose={onClose}
        mediaId={123}
        mediaType="movie"
        title="Spirited Away"
        defaultPosterPath="/poster-a.jpg"
      />,
    )

    await user.click(screen.getByTestId("poster-picker-use-default"))
    await user.click(screen.getByTestId("poster-picker-save-button"))

    await waitFor(() => {
      expect(mocks.clearPosterOverride).toHaveBeenCalledWith("movie", 123)
    })
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Default poster restored")
    expect(onClose).toHaveBeenCalled()
  })

  it("shows an error toast when saving a new poster override fails", async () => {
    const user = userEvent.setup()

    mocks.setPosterOverride.mockRejectedValueOnce(new Error("Save failed"))

    render(
      <PosterPickerModal
        isOpen
        onClose={vi.fn()}
        mediaId={123}
        mediaType="tv"
        title="Severance"
        defaultPosterPath="/poster-a.jpg"
      />,
    )

    await user.click(screen.getByTestId("poster-picker-option-/poster-b.jpg"))
    await user.click(screen.getByTestId("poster-picker-save-button"))

    await waitFor(() => {
      expect(mocks.setPosterOverride).toHaveBeenCalledWith(
        "tv",
        123,
        "/poster-b.jpg",
      )
    })
    expect(mocks.toastError).toHaveBeenCalledWith("Save failed")
  })
})
