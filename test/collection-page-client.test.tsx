import { CollectionPageClient } from "@/components/collection-page-client"
import { render, screen } from "@/test/utils"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mutateStartMock = vi.fn()
const mutateStopMock = vi.fn()
const requireAuthMock = vi.fn((action?: () => void | Promise<void>) => {
  if (action) {
    return action()
  }
})
const canTrackMoreState = {
  canTrackMore: true,
  maxFreeCollections: 2,
  isLoading: false,
}
const authState = {
  loading: false,
  premiumLoading: false,
  premiumStatus: "free",
}
const collectionTrackingState = {
  tracking: {
    watchedMovieIds: [1],
  },
  isTracked: false,
  watchedCount: 0,
  totalMovies: 0,
  percentage: 0,
  isLoading: false,
}

vi.mock("@/context/auth-context", () => ({
  useAuth: () => authState,
}))

vi.mock("@/components/auth-modal", () => ({
  AuthModal: () => null,
}))

vi.mock("@/components/premium-modal", () => ({
  PremiumModal: () => null,
}))

vi.mock("next/image", () => ({
  default: ({
    fill: _fill,
    priority: _priority,
    ...props
  }: React.ComponentProps<"img"> & {
    fill?: boolean
    priority?: boolean
  }) => <img {...props} />,
}))

vi.mock("@/hooks/use-auth-guard", () => ({
  useAuthGuard: () => ({
    requireAuth: requireAuthMock,
    modalVisible: false,
    modalMessage: undefined,
    closeModal: vi.fn(),
  }),
}))

vi.mock("@/hooks/use-collection-tracking", () => ({
  useCanTrackMoreCollections: () => canTrackMoreState,
  useCollectionTracking: () => collectionTrackingState,
  useStartCollectionTracking: () => ({
    isPending: false,
    mutateAsync: (...args: unknown[]) => mutateStartMock(...args),
  }),
  useStopCollectionTracking: () => ({
    isPending: false,
    mutateAsync: (...args: unknown[]) => mutateStopMock(...args),
  }),
}))

vi.mock("@/components/collection-movies-grid", () => ({
  CollectionMoviesGrid: ({
    watchedMovieIds,
  }: {
    watchedMovieIds: number[]
  }) => <div>Watched IDs: {watchedMovieIds.join(",")}</div>,
}))

describe("CollectionPageClient", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authState.loading = false
    authState.premiumLoading = false
    authState.premiumStatus = "free"
    canTrackMoreState.canTrackMore = true
    canTrackMoreState.maxFreeCollections = 2
    canTrackMoreState.isLoading = false
    collectionTrackingState.tracking = {
      watchedMovieIds: [1],
    }
    collectionTrackingState.isTracked = false
    collectionTrackingState.watchedCount = 0
    collectionTrackingState.totalMovies = 0
    collectionTrackingState.percentage = 0
    collectionTrackingState.isLoading = false
  })

  it("starts collection tracking from the collection page", async () => {
    const user = userEvent.setup()
    mutateStartMock.mockResolvedValueOnce(undefined)

    render(
      <CollectionPageClient
        collection={{
          id: 101,
          name: "Mad Max Collection",
          overview: "Road war.",
          poster_path: null,
          backdrop_path: null,
          parts: [
            {
              id: 1,
              media_type: "movie",
              adult: false,
              backdrop_path: null,
              poster_path: null,
              title: "Mad Max",
              overview: "",
              genre_ids: [],
              popularity: 1,
              release_date: "1979-01-01",
              vote_average: 7,
              vote_count: 1,
              original_language: "en",
            },
          ],
        }}
      />,
    )

    await user.click(screen.getByRole("button", { name: /start tracking/i }))

    expect(mutateStartMock).toHaveBeenCalledWith({
      collectionId: 101,
      name: "Mad Max Collection",
      totalMovies: 1,
      collectionMovieIds: [1],
    })
  })

  it("passes watched movie ids into the collection grid", () => {
    render(
      <CollectionPageClient
        collection={{
          id: 201,
          name: "Batman Collection",
          overview: "",
          poster_path: null,
          backdrop_path: null,
          parts: [],
        }}
      />,
    )

    expect(screen.getByText("Watched IDs: 1")).toBeInTheDocument()
  })

  it("shows loading placeholders instead of tracking controls while loading", () => {
    collectionTrackingState.isLoading = true

    const { container } = render(
      <CollectionPageClient
        collection={{
          id: 301,
          name: "John Wick Collection",
          overview: "",
          poster_path: null,
          backdrop_path: "/backdrop.jpg",
          parts: [
            {
              id: 1,
              media_type: "movie",
              adult: false,
              backdrop_path: null,
              poster_path: null,
              title: "John Wick",
              overview: "",
              genre_ids: [],
              popularity: 1,
              release_date: "2014-10-24",
              vote_average: 7,
              vote_count: 1,
              original_language: "en",
            },
          ],
        }}
      />,
    )

    expect(
      screen.queryByRole("button", { name: /start tracking/i }),
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/Watched \d+ of/i)).not.toBeInTheDocument()
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(
      0,
    )
  })

  it("keeps showing loading placeholders while auth state is unresolved", () => {
    authState.loading = true

    const { container } = render(
      <CollectionPageClient
        collection={{
          id: 401,
          name: "Mission: Impossible Collection",
          overview: "",
          poster_path: null,
          backdrop_path: "/backdrop.jpg",
          parts: [
            {
              id: 1,
              media_type: "movie",
              adult: false,
              backdrop_path: null,
              poster_path: null,
              title: "Mission: Impossible",
              overview: "",
              genre_ids: [],
              popularity: 1,
              release_date: "1996-05-22",
              vote_average: 7,
              vote_count: 1,
              original_language: "en",
            },
          ],
        }}
      />,
    )

    expect(
      screen.queryByRole("button", { name: /start tracking/i }),
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/Watched \d+ of/i)).not.toBeInTheDocument()
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(
      0,
    )
  })
})
