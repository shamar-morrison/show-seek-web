import { ShuffleDialog } from "@/components/shuffle-dialog"
import { act, fireEvent, render, screen } from "@/test/utils"
import type { ListMediaItem } from "@/types/list"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  buildImageUrl: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mocks.push,
  }),
}))

vi.mock("@/lib/tmdb", () => ({
  buildImageUrl: (...args: unknown[]) => mocks.buildImageUrl(...args),
}))

vi.mock("@/components/ui/base-media-modal", () => ({
  BaseMediaModal: ({
    isOpen,
    title,
    children,
  }: {
    isOpen: boolean
    title: string
    children: React.ReactNode
  }) =>
    isOpen ? (
      <div>
        <h1>{title}</h1>
        {children}
      </div>
    ) : null,
}))

vi.mock("@/hooks/use-poster-overrides", () => ({
  usePosterOverrides: () => ({
    overrides: {},
    resolvePosterPath: (
      _mediaType: "movie" | "tv",
      _mediaId: number,
      fallbackPosterPath: string | null | undefined,
    ) => fallbackPosterPath ?? null,
  }),
}))

function createItem(
  id: number,
  title: string,
  overrides: Partial<ListMediaItem> = {},
): ListMediaItem {
  return {
    id,
    title,
    poster_path: `/poster-${id}.jpg`,
    media_type: "movie",
    addedAt: id,
    vote_average: 7.5,
    release_date: "2024-01-01",
    ...overrides,
  }
}

describe("ShuffleDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    mocks.buildImageUrl.mockImplementation((path: string) =>
      `https://image.tmdb.org/t/p/w500${path}`,
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  async function advance(ms: number) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms)
    })
  }

  it("renders the initial shuffling state when opened", () => {
    render(
      <ShuffleDialog
        isOpen={true}
        onClose={vi.fn()}
        items={[createItem(1, "Movie One"), createItem(2, "Movie Two")]}
      />,
    )

    expect(screen.getByRole("heading", { name: "Shuffle" })).toBeInTheDocument()
    expect(screen.getByText("Shuffle Pick")).toBeInTheDocument()
    expect(screen.getByTestId("shuffle-spin-button")).toHaveTextContent(
      "Shuffling...",
    )
    expect(screen.getByTestId("shuffle-spin-button")).toBeDisabled()
  })

  it("reveals a selected item after the animation completes", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.75)

    render(
      <ShuffleDialog
        isOpen={true}
        onClose={vi.fn()}
        items={[createItem(1, "Movie One"), createItem(2, "Movie Two")]}
      />,
    )

    await advance(2600)

    expect(screen.getByText("Movie Two")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "View details" }),
    ).toBeInTheDocument()
    expect(screen.getByTestId("shuffle-spin-button")).toHaveTextContent(
      "Spin again",
    )
    expect(screen.getByTestId("shuffle-spin-button")).toBeEnabled()
  })

  it("restarts the animation when spin again is pressed", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.75)

    render(
      <ShuffleDialog
        isOpen={true}
        onClose={vi.fn()}
        items={[createItem(1, "Movie One"), createItem(2, "Movie Two")]}
      />,
    )

    await advance(2600)
    fireEvent.click(screen.getByTestId("shuffle-spin-button"))

    expect(screen.queryByRole("button", { name: "View details" })).not.toBeInTheDocument()
    expect(screen.getByTestId("shuffle-spin-button")).toHaveTextContent(
      "Shuffling...",
    )
    expect(screen.getByTestId("shuffle-spin-button")).toBeDisabled()
  })

  it("navigates to the movie detail route", async () => {
    const onClose = vi.fn()
    vi.spyOn(Math, "random").mockReturnValue(0)

    render(
      <ShuffleDialog
        isOpen={true}
        onClose={onClose}
        items={[createItem(42, "Movie Choice", { media_type: "movie" })]}
      />,
    )

    await advance(400)
    fireEvent.click(screen.getByRole("button", { name: "View details" }))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(mocks.push).toHaveBeenCalledWith("/movie/42")
  })

  it("navigates to the tv detail route", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0)

    render(
      <ShuffleDialog
        isOpen={true}
        onClose={vi.fn()}
        items={[
          createItem(99, "TV Choice", {
            media_type: "tv",
            title: "",
            name: "TV Choice",
          }),
        ]}
      />,
    )

    await advance(400)
    fireEvent.click(screen.getByRole("button", { name: "View details" }))

    expect(mocks.push).toHaveBeenCalledWith("/tv/99")
  })

  it("shows the fallback when the selected item has no poster", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0)

    render(
      <ShuffleDialog
        isOpen={true}
        onClose={vi.fn()}
        items={[createItem(1, "Posterless", { poster_path: null })]}
      />,
    )

    await advance(400)

    expect(screen.getByText("No image")).toBeInTheDocument()
    expect(mocks.buildImageUrl).not.toHaveBeenCalled()
  })
})
