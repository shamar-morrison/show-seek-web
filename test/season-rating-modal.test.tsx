import { SeasonRatingModal } from "@/components/season-rating-modal"
import { render, screen, waitFor } from "@/test/utils"
import type { TMDBSeasonDetails } from "@/types/tmdb"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getSeasonRating: vi.fn(),
  removeSeasonRating: vi.fn(),
  saveSeasonRating: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock("@/hooks/use-ratings", () => ({
  useRatings: () => ({
    getSeasonRating: mocks.getSeasonRating,
    saveSeasonRating: mocks.saveSeasonRating,
    removeSeasonRating: mocks.removeSeasonRating,
  }),
}))

vi.mock("sonner", () => ({
  toast: {
    error: mocks.toastError,
  },
}))

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({
    children,
    open,
  }: {
    children: ReactNode
    open: boolean
  }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h1>{children}</h1>,
}))

function createSeason(): TMDBSeasonDetails {
  return {
    id: 10,
    season_number: 2,
    name: "Season 2",
    overview: "Season overview",
    poster_path: "/season-2.jpg",
    air_date: "2025-01-01",
    vote_average: 8.4,
    episodes: [],
  }
}

describe("SeasonRatingModal", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getSeasonRating.mockReturnValue(null)
    mocks.saveSeasonRating.mockResolvedValue(undefined)
    mocks.removeSeasonRating.mockResolvedValue(undefined)
  })

  it("saves a season rating with the expected payload", async () => {
    const user = userEvent.setup()

    render(
      <SeasonRatingModal
        isOpen
        onClose={vi.fn()}
        season={createSeason()}
        tvShowId={777}
        tvShowName="Signal Run"
        displayTvShowName="Signal Run"
      />,
    )

    await user.click(screen.getByRole("button", { name: "Rate 8 out of 10" }))
    await user.click(screen.getByRole("button", { name: "Save Rating" }))

    await waitFor(() => {
      expect(mocks.saveSeasonRating).toHaveBeenCalledWith({
        tvShowId: 777,
        seasonNumber: 2,
        rating: 8,
        seasonName: "Season 2",
        tvShowName: "Signal Run",
        posterPath: "/season-2.jpg",
        airDate: "2025-01-01",
      })
    })
  })

  it("loads and clears an existing season rating", async () => {
    const user = userEvent.setup()

    mocks.getSeasonRating.mockReturnValue({
      id: "season-777-2",
      mediaId: "777",
      mediaType: "season",
      rating: 8.5,
      title: "Season 2",
      posterPath: "/season-2.jpg",
      releaseDate: "2025-01-01",
      ratedAt: 1,
      tvShowId: 777,
      seasonNumber: 2,
      tvShowName: "Signal Run",
    })

    render(
      <SeasonRatingModal
        isOpen
        onClose={vi.fn()}
        season={createSeason()}
        tvShowId={777}
        tvShowName="Signal Run"
      />,
    )

    expect(screen.getByText("8.5/10")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Clear Rating" }))

    await waitFor(() => {
      expect(mocks.removeSeasonRating).toHaveBeenCalledWith(777, 2)
    })
  })

  it("shows a toast and keeps the modal open when saving fails", async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    mocks.saveSeasonRating.mockRejectedValue(new Error("Network down"))

    render(
      <SeasonRatingModal
        isOpen
        onClose={onClose}
        season={createSeason()}
        tvShowId={777}
        tvShowName="Signal Run"
      />,
    )

    await user.click(screen.getByRole("button", { name: "Rate 8 out of 10" }))
    await user.click(screen.getByRole("button", { name: "Save Rating" }))

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Failed to save season rating: Network down",
      )
    })

    expect(onClose).not.toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
  })

  it("shows a toast and keeps the modal open when clearing fails", async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    mocks.getSeasonRating.mockReturnValue({
      id: "season-777-2",
      mediaId: "777",
      mediaType: "season",
      rating: 8.5,
      title: "Season 2",
      posterPath: "/season-2.jpg",
      releaseDate: "2025-01-01",
      ratedAt: 1,
      tvShowId: 777,
      seasonNumber: 2,
      tvShowName: "Signal Run",
    })
    mocks.removeSeasonRating.mockRejectedValue(new Error("Network down"))

    render(
      <SeasonRatingModal
        isOpen
        onClose={onClose}
        season={createSeason()}
        tvShowId={777}
        tvShowName="Signal Run"
      />,
    )

    await user.click(screen.getByRole("button", { name: "Clear Rating" }))

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Failed to clear season rating: Network down",
      )
    })

    expect(onClose).not.toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
  })
})
