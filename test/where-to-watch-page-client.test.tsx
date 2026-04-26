import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { WhereToWatchPageClient } from "@/components/where-to-watch-page-client"
import type { UserList } from "@/types/list"
import type { WatchProvider } from "@/types/tmdb"
import { render, screen } from "./utils"

const refetchListsMock = vi.fn()

const authState = {
  isPremium: true,
  premiumLoading: false,
  premiumStatus: "premium" as "unknown" | "free" | "premium",
}

const listsState: {
  lists: UserList[]
  loading: boolean
  error: Error | null
} = {
  lists: [],
  loading: false,
  error: null,
}

const preferencesState = {
  preferences: {
    showOriginalTitles: false,
  },
  region: "US" as const,
}

const enrichmentState = {
  providerMap: new Map<string, unknown>(),
  isLoadingEnrichment: false,
  enrichmentProgress: 1,
}

const catalogState: Record<
  "movie" | "tv",
  {
    data: WatchProvider[]
    isLoading: boolean
    isError: boolean
  }
> = {
  movie: {
    data: [],
    isLoading: false,
    isError: false,
  },
  tv: {
    data: [],
    isLoading: false,
    isError: false,
  },
}

const useQueryMock = vi.fn((options: { queryKey: unknown[] }) => {
  const mediaType = options.queryKey[2] as "movie" | "tv"
  return {
    data: catalogState[mediaType].data,
    isLoading: catalogState[mediaType].isLoading,
    isError: catalogState[mediaType].isError,
  }
})

vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: { queryKey: unknown[] }) => useQueryMock(options),
}))

vi.mock("@/context/auth-context", () => ({
  useAuth: () => authState,
}))

vi.mock("@/hooks/use-lists", () => ({
  useLists: () => ({
    lists: listsState.lists,
    loading: listsState.loading,
    error: listsState.error,
    refetch: refetchListsMock,
  }),
}))

vi.mock("@/hooks/use-preferences", () => ({
  usePreferences: () => preferencesState,
}))

vi.mock("@/hooks/use-watch-provider-enrichment", () => ({
  useWatchProviderEnrichment: () => enrichmentState,
}))

vi.mock("@/components/premium-modal", () => ({
  PremiumModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="premium-modal">Premium modal open</div> : null,
}))

function createLists(): UserList[] {
  return [
    {
      id: "watchlist",
      name: "Should Watch",
      createdAt: 1,
      items: {
        "movie-101": {
          id: 101,
          media_type: "movie",
          title: "Movie A",
          poster_path: "/movie-a.jpg",
          release_date: "2024-01-01",
          vote_average: 7,
          addedAt: 2,
        },
        "tv-202": {
          id: 202,
          media_type: "tv",
          title: "Show B",
          name: "Show B",
          poster_path: "/show-b.jpg",
          first_air_date: "2024-02-01",
          vote_average: 8,
          addedAt: 1,
        },
      },
    },
    {
      id: "weekend-picks",
      name: "Weekend Picks",
      createdAt: 2,
      items: {},
    },
  ]
}

function setCatalogDefaults() {
  catalogState.movie = {
    data: [
      {
        provider_id: 8,
        provider_name: "Netflix",
        logo_path: "/netflix.png",
        display_priority: 1,
      },
      {
        provider_id: 2,
        provider_name: "Apple TV",
        logo_path: "/apple.png",
        display_priority: 2,
      },
    ],
    isLoading: false,
    isError: false,
  }
  catalogState.tv = {
    data: [
      {
        provider_id: 8,
        provider_name: "Netflix",
        logo_path: "/netflix.png",
        display_priority: 1,
      },
    ],
    isLoading: false,
    isError: false,
  }
}

function setEnrichmentDefaults() {
  enrichmentState.providerMap = new Map<string, unknown>([
    [
      "movie-101",
      {
        flatrate: [
          {
            provider_id: 8,
            provider_name: "Netflix",
            logo_path: "/netflix.png",
            display_priority: 1,
          },
        ],
        rent: [
          {
            provider_id: 2,
            provider_name: "Apple TV",
            logo_path: "/apple.png",
            display_priority: 2,
          },
        ],
      },
    ],
    [
      "tv-202",
      {
        buy: [
          {
            provider_id: 8,
            provider_name: "Netflix",
            logo_path: "/netflix.png",
            display_priority: 1,
          },
        ],
      },
    ],
  ])
  enrichmentState.isLoadingEnrichment = false
  enrichmentState.enrichmentProgress = 1
}

async function selectList(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByTestId("where-to-watch-list-selector"))
  await user.click(
    await screen.findByRole("option", { name: "Should Watch (2 items)" }),
  )
}

async function selectService(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByTestId("where-to-watch-service-selector"))
  await user.click(await screen.findByRole("option", { name: /Netflix/ }))
}

describe("WhereToWatchPageClient", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authState.isPremium = true
    authState.premiumLoading = false
    authState.premiumStatus = "premium"
    listsState.lists = createLists()
    listsState.loading = false
    listsState.error = null
    preferencesState.preferences.showOriginalTitles = false
    preferencesState.region = "US"
    setCatalogDefaults()
    setEnrichmentDefaults()
  })

  it("shows the initial empty state and disables service selection before a list is selected", () => {
    render(<WhereToWatchPageClient />)

    expect(screen.getAllByText("Choose a list").length).toBeGreaterThan(0)
    expect(screen.getByTestId("where-to-watch-service-selector")).toBeDisabled()
  })

  it("shows list options with counts and list loading or error states", () => {
    const { rerender } = render(<WhereToWatchPageClient />)

    expect(
      screen.getByTestId("where-to-watch-list-selector"),
    ).toHaveTextContent("Choose a list")

    listsState.error = new Error("Network failed")
    listsState.lists = []
    rerender(<WhereToWatchPageClient />)

    expect(screen.getByText("Couldn't load your lists.")).toBeInTheDocument()
    expect(
      screen.getByTestId("where-to-watch-list-selector"),
    ).toHaveTextContent("Unable to load lists")
  })

  it("shows list options with counts in the custom list select", async () => {
    const user = userEvent.setup()

    render(<WhereToWatchPageClient />)

    await user.click(screen.getByTestId("where-to-watch-list-selector"))

    expect(
      await screen.findByRole("option", { name: "Should Watch (2 items)" }),
    ).toBeInTheDocument()
  })

  it("shows a focused search input and filters list options by typed name", async () => {
    const user = userEvent.setup()

    render(<WhereToWatchPageClient />)

    await user.click(screen.getByTestId("where-to-watch-list-selector"))

    const searchInput = screen.getByPlaceholderText("Search lists...")
    expect(searchInput).toHaveFocus()

    await user.type(searchInput, "weekend")

    expect(
      screen.getByRole("option", { name: "Weekend Picks (0 items)" }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("option", { name: "Should Watch (2 items)" }),
    ).not.toBeInTheDocument()
  })

  it("shows provider catalog errors before no-service empty states", async () => {
    const user = userEvent.setup()
    catalogState.movie = { data: [], isLoading: false, isError: true }
    catalogState.tv = { data: [], isLoading: false, isError: false }

    render(<WhereToWatchPageClient />)

    await selectList(user)

    expect(
      screen.getByText("Unable to load streaming services"),
    ).toBeInTheDocument()
    expect(
      screen.queryByText("Choose a streaming service"),
    ).not.toBeInTheDocument()
  })

  it("counts and filters only flatrate provider matches", async () => {
    const user = userEvent.setup()

    render(<WhereToWatchPageClient />)

    await selectList(user)
    await user.click(screen.getByTestId("where-to-watch-service-selector"))

    expect(
      await screen.findByRole("option", { name: /Netflix/ }),
    ).toBeInTheDocument()
    expect(screen.getByText("1 item")).toBeInTheDocument()
    expect(screen.getByTestId("where-to-watch-service-logo-8")).toHaveAttribute(
      "src",
      "https://image.tmdb.org/t/p/w92/netflix.png",
    )
    expect(
      screen.queryByRole("option", { name: /Apple TV/ }),
    ).not.toBeInTheDocument()

    await user.click(await screen.findByRole("option", { name: /Netflix/ }))

    expect(
      screen.getByTestId("where-to-watch-service-selector"),
    ).toHaveTextContent("Netflix")
    expect(
      screen.getByTestId("where-to-watch-selected-service-logo"),
    ).toHaveAttribute("src", "https://image.tmdb.org/t/p/w92/netflix.png")
    expect(screen.getByText("Movie A")).toBeInTheDocument()
    expect(screen.queryByText("Show B")).not.toBeInTheDocument()
    expect(screen.getByTestId("where-to-watch-result-card")).toHaveAttribute(
      "href",
      "/movie/101",
    )
  })

  it("shows a focused search input and filters services by typed name", async () => {
    const user = userEvent.setup()
    catalogState.movie.data.push({
      provider_id: 337,
      provider_name: "Disney+",
      logo_path: "/disney.png",
      display_priority: 3,
    })
    enrichmentState.providerMap = new Map<string, unknown>([
      [
        "movie-101",
        {
          flatrate: [
            {
              provider_id: 8,
              provider_name: "Netflix",
              logo_path: "/netflix.png",
              display_priority: 1,
            },
            {
              provider_id: 337,
              provider_name: "Disney+",
              logo_path: "/disney.png",
              display_priority: 3,
            },
          ],
        },
      ],
      [
        "tv-202",
        {
          flatrate: [
            {
              provider_id: 8,
              provider_name: "Netflix",
              logo_path: "/netflix.png",
              display_priority: 1,
            },
          ],
        },
      ],
    ])

    render(<WhereToWatchPageClient />)

    await selectList(user)
    await user.click(screen.getByTestId("where-to-watch-service-selector"))

    const searchInput = screen.getByPlaceholderText("Search services...")
    expect(searchInput).toHaveFocus()

    await user.type(searchInput, "disney")

    expect(screen.getByRole("option", { name: /Disney\+/ })).toBeInTheDocument()
    expect(screen.queryByRole("option", { name: /Netflix/ })).not.toBeInTheDocument()
  })

  it("treats a selected list that no longer exists as inactive", async () => {
    const user = userEvent.setup()
    const { rerender } = render(<WhereToWatchPageClient />)

    await selectList(user)

    expect(
      screen.getByTestId("where-to-watch-list-selector"),
    ).toHaveTextContent("Should Watch (2 items)")

    listsState.lists = []
    rerender(<WhereToWatchPageClient />)

    expect(
      screen.getByTestId("where-to-watch-list-selector"),
    ).toHaveTextContent("No lists available")
    expect(screen.getByTestId("where-to-watch-service-selector")).toBeDisabled()
    expect(screen.getAllByText("Choose a list").length).toBeGreaterThan(0)
  })

  it("treats a selected service with no current matches as inactive", async () => {
    const user = userEvent.setup()
    const { rerender } = render(<WhereToWatchPageClient />)

    await selectList(user)
    await selectService(user)

    expect(
      screen.getByTestId("where-to-watch-service-selector"),
    ).toHaveTextContent("Netflix")
    expect(screen.getByText("Movie A")).toBeInTheDocument()

    enrichmentState.providerMap = new Map<string, unknown>([
      [
        "movie-101",
        {
          flatrate: [
            {
              provider_id: 2,
              provider_name: "Apple TV",
              logo_path: "/apple.png",
              display_priority: 2,
            },
          ],
        },
      ],
    ])
    rerender(<WhereToWatchPageClient />)

    expect(
      screen.getByTestId("where-to-watch-service-selector"),
    ).toHaveTextContent("Choose a service")
    expect(
      screen.getAllByText("Choose a streaming service").length,
    ).toBeGreaterThan(0)
    expect(screen.queryByText("Movie A")).not.toBeInTheDocument()
  })

  it("shows the premium gate for free users and opens the premium modal", async () => {
    const user = userEvent.setup()
    authState.isPremium = false
    authState.premiumStatus = "free"

    render(<WhereToWatchPageClient />)

    await selectList(user)

    expect(
      screen.getByTestId("where-to-watch-premium-overlay"),
    ).toBeInTheDocument()
    expect(screen.getByTestId("where-to-watch-service-selector")).toBeDisabled()

    await user.click(screen.getByTestId("where-to-watch-upgrade-button"))

    expect(screen.getByTestId("premium-modal")).toBeInTheDocument()
  })
})
