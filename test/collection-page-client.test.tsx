import { CollectionPageClient } from "@/components/collection-page-client"
import { render, screen, waitFor, within } from "@/test/utils"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mutateStartMock = vi.fn()
const mutateStopMock = vi.fn()
const toastErrorMock = vi.fn()
const toastSuccessMock = vi.fn()
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
    collectionId: 0,
    name: "",
    totalMovies: 0,
    watchedMovieIds: [1],
    startedAt: 0,
    lastUpdated: 0,
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

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastErrorMock(...args),
    success: (...args: unknown[]) => toastSuccessMock(...args),
  },
}))

vi.mock("@/components/collection-movies-grid", () => ({
  CollectionMoviesGrid: ({
    movies,
    collectionId,
    isTracked,
    watchedMovieIds,
  }: {
    movies: Array<{ id: number }>
    collectionId?: number
    isTracked?: boolean
    watchedMovieIds?: number[]
  }) => (
    <div data-testid="collection-movies-grid">
      <div>Collection ID: {collectionId ?? "missing"}</div>
      <div>Movie IDs: {movies.map((movie) => movie.id).join(",")}</div>
      <div>Is Tracked: {String(Boolean(isTracked))}</div>
      <div>Watched IDs: {(watchedMovieIds ?? []).join(",")}</div>
    </div>
  ),
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
      collectionId: 0,
      name: "",
      totalMovies: 0,
      watchedMovieIds: [1],
      startedAt: 0,
      lastUpdated: 0,
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
    expect(toastSuccessMock).toHaveBeenCalledWith(
      "Collection tracking started",
      expect.objectContaining({
        action: expect.objectContaining({
          label: "Undo",
          onClick: expect.any(Function),
        }),
      }),
    )
  })

  it("passes collection tracking props into the collection grid", () => {
    collectionTrackingState.isTracked = true
    collectionTrackingState.tracking = {
      collectionId: 0,
      name: "",
      totalMovies: 0,
      watchedMovieIds: [1],
      startedAt: 0,
      lastUpdated: 0,
    }

    render(
      <CollectionPageClient
        collection={{
          id: 201,
          name: "Batman Collection",
          overview: "",
          poster_path: null,
          backdrop_path: null,
          parts: [
            {
              id: 1,
              media_type: "movie",
              adult: false,
              backdrop_path: null,
              poster_path: null,
              title: "Batman",
              overview: "",
              genre_ids: [],
              popularity: 1,
              release_date: "1989-06-23",
              vote_average: 7,
              vote_count: 1,
              original_language: "en",
            },
            {
              id: 2,
              media_type: "movie",
              adult: false,
              backdrop_path: null,
              poster_path: null,
              title: "Batman Returns",
              overview: "",
              genre_ids: [],
              popularity: 1,
              release_date: "1992-06-19",
              vote_average: 7,
              vote_count: 1,
              original_language: "en",
            },
          ],
        }}
      />,
    )

    expect(screen.getByTestId("collection-movies-grid")).toBeInTheDocument()
    expect(screen.getByText("Collection ID: 201")).toBeInTheDocument()
    expect(screen.getByText("Movie IDs: 1,2")).toBeInTheDocument()
    expect(screen.getByText("Is Tracked: true")).toBeInTheDocument()
    expect(screen.getByText("Watched IDs: 1")).toBeInTheDocument()
  })

  it("keeps the stop flow enabled while the tracking limit query is loading", () => {
    collectionTrackingState.isTracked = true
    collectionTrackingState.tracking = {
      collectionId: 0,
      name: "",
      totalMovies: 0,
      watchedMovieIds: [1],
      startedAt: 0,
      lastUpdated: 0,
    }
    collectionTrackingState.watchedCount = 1
    collectionTrackingState.totalMovies = 1
    collectionTrackingState.percentage = 100
    canTrackMoreState.isLoading = true

    render(
      <CollectionPageClient
        collection={{
          id: 250,
          name: "Blade Collection",
          overview: "",
          poster_path: null,
          backdrop_path: null,
          parts: [
            {
              id: 1,
              media_type: "movie",
              adult: false,
              backdrop_path: null,
              poster_path: null,
              title: "Blade",
              overview: "",
              genre_ids: [],
              popularity: 1,
              release_date: "1998-08-21",
              vote_average: 7,
              vote_count: 1,
              original_language: "en",
            },
          ],
        }}
      />,
    )

    expect(screen.getByRole("button", { name: /stop tracking/i })).toBeEnabled()
  })

  it("recomputes the displayed progress when tracked totals are stale", () => {
    collectionTrackingState.isTracked = true
    collectionTrackingState.tracking = {
      collectionId: 0,
      name: "",
      totalMovies: 0,
      watchedMovieIds: [1, 2],
      startedAt: 0,
      lastUpdated: 0,
    }
    collectionTrackingState.watchedCount = 2
    collectionTrackingState.totalMovies = 2
    collectionTrackingState.percentage = 100

    const { container } = render(
      <CollectionPageClient
        collection={{
          id: 260,
          name: "The Avengers Collection",
          overview: "",
          poster_path: null,
          backdrop_path: null,
          parts: [
            {
              id: 1,
              media_type: "movie",
              adult: false,
              backdrop_path: null,
              poster_path: null,
              title: "Movie 1",
              overview: "",
              genre_ids: [],
              popularity: 1,
              release_date: "2012-05-04",
              vote_average: 7,
              vote_count: 1,
              original_language: "en",
            },
            {
              id: 2,
              media_type: "movie",
              adult: false,
              backdrop_path: null,
              poster_path: null,
              title: "Movie 2",
              overview: "",
              genre_ids: [],
              popularity: 1,
              release_date: "2015-05-01",
              vote_average: 7,
              vote_count: 1,
              original_language: "en",
            },
            {
              id: 3,
              media_type: "movie",
              adult: false,
              backdrop_path: null,
              poster_path: null,
              title: "Movie 3",
              overview: "",
              genre_ids: [],
              popularity: 1,
              release_date: "2018-04-27",
              vote_average: 7,
              vote_count: 1,
              original_language: "en",
            },
            {
              id: 4,
              media_type: "movie",
              adult: false,
              backdrop_path: null,
              poster_path: null,
              title: "Movie 4",
              overview: "",
              genre_ids: [],
              popularity: 1,
              release_date: "2019-04-26",
              vote_average: 7,
              vote_count: 1,
              original_language: "en",
            },
          ],
        }}
      />,
    )

    expect(screen.getByText("2/4 watched")).toBeInTheDocument()
    expect(screen.getByText("Watched 2 of 4")).toBeInTheDocument()
    expect(screen.getByText("50%")).toBeInTheDocument()
    expect(screen.queryByText("100%")).not.toBeInTheDocument()
    expect(
      container.querySelector(".h-full.rounded-full.bg-primary.transition-all"),
    ).toHaveStyle({ width: "50%" })
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
    expect(
      screen.queryByTestId("collection-movies-grid"),
    ).not.toBeInTheDocument()
    expect(
      screen.getByTestId("collection-movies-grid-skeleton"),
    ).toBeInTheDocument()
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(
      0,
    )
  })

  it("restarts tracking from the stop toast undo action", async () => {
    const user = userEvent.setup()
    collectionTrackingState.isTracked = true
    collectionTrackingState.tracking = {
      collectionId: 250,
      name: "Blade Collection",
      totalMovies: 1,
      watchedMovieIds: [1],
      startedAt: 1,
      lastUpdated: 1,
    }
    collectionTrackingState.watchedCount = 1
    collectionTrackingState.totalMovies = 1
    collectionTrackingState.percentage = 100
    mutateStopMock.mockResolvedValueOnce([1])

    render(
      <CollectionPageClient
        collection={{
          id: 250,
          name: "Blade Collection",
          overview: "",
          poster_path: null,
          backdrop_path: null,
          parts: [
            {
              id: 1,
              media_type: "movie",
              adult: false,
              backdrop_path: null,
              poster_path: null,
              title: "Blade",
              overview: "",
              genre_ids: [],
              popularity: 1,
              release_date: "1998-08-21",
              vote_average: 7,
              vote_count: 1,
              original_language: "en",
            },
          ],
        }}
      />,
    )

    await user.click(screen.getByRole("button", { name: /stop tracking/i }))
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: /stop tracking/i,
      }),
    )

    await waitFor(() => {
      expect(toastSuccessMock).toHaveBeenCalledWith(
        "Collection tracking stopped",
        expect.objectContaining({
          action: expect.objectContaining({
            label: "Undo",
            onClick: expect.any(Function),
          }),
        }),
      )
    })

    const toastOptions = toastSuccessMock.mock.calls.at(-1)?.[1] as {
      action: { onClick: () => void | Promise<void> }
    }

    toastOptions.action.onClick()

    await waitFor(() => {
      expect(mutateStartMock).toHaveBeenLastCalledWith({
        collectionId: 250,
        name: "Blade Collection",
        totalMovies: 1,
        initialWatchedMovieIds: [1],
        collectionMovieIds: undefined,
      })
    })
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
    expect(
      screen.queryByTestId("collection-movies-grid"),
    ).not.toBeInTheDocument()
    expect(
      screen.getByTestId("collection-movies-grid-skeleton"),
    ).toBeInTheDocument()
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(
      0,
    )
  })
})
