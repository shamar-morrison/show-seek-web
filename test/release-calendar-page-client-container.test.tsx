import { ReleaseCalendarPageClient } from "@/components/release-calendar-page-client"
import { PREMIUM_LOADING_MESSAGE } from "@/lib/premium-gating"
import { render, screen } from "./utils"
import { beforeEach, describe, expect, it, vi } from "vitest"

const useAuthMock = vi.fn()
const useReleaseCalendarMock = vi.fn()

vi.mock("@/context/auth-context", () => ({
  useAuth: () => useAuthMock(),
}))

vi.mock("@/hooks/use-release-calendar", () => ({
  useReleaseCalendar: () => useReleaseCalendarMock(),
}))

vi.mock("@/components/premium-modal", () => ({
  PremiumModal: () => null,
}))

function createRelease(id: number, releaseDate: string) {
  return {
    id,
    mediaType: "movie" as const,
    title: `Release ${id}`,
    posterPath: null,
    backdropPath: null,
    releaseDate,
    sourceLists: ["watchlist" as const],
    uniqueKey: `movie-${id}`,
  }
}

describe("ReleaseCalendarPageClient", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    useReleaseCalendarMock.mockReturnValue({
      error: null,
      isBootstrapping: false,
      isRefreshing: false,
      releases: [
        createRelease(1, "2099-04-10"),
        createRelease(2, "2099-04-11"),
        createRelease(3, "2099-04-12"),
        createRelease(4, "2099-04-13"),
      ],
    })
  })

  it("renders the preview-safe calendar while premium status is unresolved and expands once premium resolves", () => {
    useAuthMock.mockReturnValue({
      isPremium: true,
      premiumLoading: true,
      premiumStatus: "unknown",
    })

    const { rerender } = render(<ReleaseCalendarPageClient />)

    expect(screen.queryByText(PREMIUM_LOADING_MESSAGE)).not.toBeInTheDocument()
    expect(screen.getByText("Release 1")).toBeInTheDocument()
    expect(screen.getByText("Release 2")).toBeInTheDocument()
    expect(screen.getByText("Release 3")).toBeInTheDocument()
    expect(screen.queryByText("Release 4")).not.toBeInTheDocument()
    expect(screen.getByText("Previewing first 3")).toBeInTheDocument()

    useAuthMock.mockReturnValue({
      isPremium: true,
      premiumLoading: false,
      premiumStatus: "premium",
    })

    rerender(<ReleaseCalendarPageClient />)

    expect(screen.getByText("Release 4")).toBeInTheDocument()
    expect(screen.queryByText("Previewing first 3")).not.toBeInTheDocument()
  })

  it("shows the calendar skeleton shell during bootstrap instead of a centered loading message", () => {
    useAuthMock.mockReturnValue({
      isPremium: false,
      premiumLoading: false,
      premiumStatus: "free",
    })

    useReleaseCalendarMock.mockReturnValue({
      error: null,
      isBootstrapping: true,
      isRefreshing: false,
      releases: [],
    })

    render(<ReleaseCalendarPageClient />)

    expect(screen.getByTestId("release-calendar-skeleton")).toBeInTheDocument()
    expect(screen.getAllByTestId("release-calendar-skeleton-card")).toHaveLength(8)
    expect(screen.queryByText("Loading release calendar...")).not.toBeInTheDocument()
  })

  it("shows the inline updating state instead of the full-page loader for tv-only refreshes", () => {
    useAuthMock.mockReturnValue({
      isPremium: false,
      premiumLoading: false,
      premiumStatus: "free",
    })

    useReleaseCalendarMock.mockReturnValue({
      error: null,
      isBootstrapping: false,
      isRefreshing: true,
      releases: [],
    })

    render(<ReleaseCalendarPageClient />)

    expect(screen.getByText("Updating releases...")).toBeInTheDocument()
    expect(screen.getByTestId("release-calendar-skeleton")).toBeInTheDocument()
    expect(screen.getAllByTestId("release-calendar-skeleton-card")).toHaveLength(8)
    expect(screen.queryByText("No upcoming releases found")).not.toBeInTheDocument()
  })
})
