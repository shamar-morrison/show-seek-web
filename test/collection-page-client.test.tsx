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

vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({
    premiumLoading: false,
    premiumStatus: "free",
  }),
}))

vi.mock("@/components/auth-modal", () => ({
  AuthModal: () => null,
}))

vi.mock("@/components/premium-modal", () => ({
  PremiumModal: () => null,
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
  useCanTrackMoreCollections: () => ({
    canTrackMore: true,
    maxFreeCollections: 2,
    isLoading: false,
  }),
  useCollectionTracking: () => ({
    tracking: {
      watchedMovieIds: [1],
    },
    isTracked: false,
    watchedCount: 0,
    totalMovies: 0,
    percentage: 0,
    isLoading: false,
  }),
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
})
