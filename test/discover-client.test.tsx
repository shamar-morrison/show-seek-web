import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { DEFAULT_PREFERENCES } from "@/lib/user-preferences"
import type {
  Genre,
  TMDBDiscoverResponse,
  TMDBLanguage,
  TMDBWatchProviderOption,
} from "@/types/tmdb"
import { render, screen, waitFor } from "./utils"

const pushMock = vi.fn()

let mockSearchParams = new URLSearchParams()
let mockAuthState: {
  loading: boolean
  premiumStatus: "free" | "premium" | "unknown"
  user: { isAnonymous: boolean; uid: string } | null
} = {
  loading: false,
  premiumStatus: "free",
  user: null,
}

vi.mock("@/components/media-card-with-actions", () => ({
  MediaCardWithActions: ({ media }: { media: { title?: string; name?: string } }) => (
    <div>{media.title ?? media.name}</div>
  ),
}))

vi.mock("@/components/page-container", () => ({
  PageContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/trailer-modal", () => ({
  TrailerModal: () => null,
}))

vi.mock("@/components/ui/empty", () => ({
  Empty: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  EmptyContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  EmptyDescription: ({ children }: { children: ReactNode }) => (
    <p>{children}</p>
  ),
  EmptyHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  EmptyMedia: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  EmptyTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}))

vi.mock("@/components/ui/filter-select", () => ({
  FilterSelect: ({
    label,
    value,
    options,
    onChange,
    disabled,
  }: {
    disabled?: boolean
    label?: ReactNode
    onChange: (value: string | null) => void
    options: Array<{ label: string; value: string }>
    value: string | null
  }) => {
    const ariaLabel = typeof label === "string" ? label : "filter-select"

    return (
      <label>
        <span>{label}</span>
        <select
          aria-label={ariaLabel}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value || null)}
          value={value ?? ""}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    )
  },
}))

vi.mock("@/components/ui/pagination", () => ({
  Pagination: () => null,
}))

vi.mock("@/components/ui/virtualized-filter-combobox", () => ({
  VirtualizedFilterCombobox: ({
    disabled,
    label,
    onChange,
    options,
    value,
  }: {
    disabled?: boolean
    label?: ReactNode
    onChange?: (value: string | null) => void
    options: Array<{ label: string; value: string }>
    value?: string | null
  }) => {
    const ariaLabel = typeof label === "string" ? label : "filter-combobox"

    return (
      <label>
        <span>{label}</span>
        <select
          aria-label={ariaLabel}
          disabled={disabled}
          onChange={(event) => onChange?.(event.target.value || null)}
          value={value ?? ""}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    )
  },
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
  }: {
    children?: ReactNode
    onClick?: () => void
  }) => (
    <button onClick={onClick} type="button">
      {children}
    </button>
  ),
}))

vi.mock("@/context/auth-context", () => ({
  useAuth: () => mockAuthState,
}))

vi.mock("@/hooks/use-lists", () => ({
  useLists: () => ({
    error: null,
    lists: [],
    loading: false,
    removeList: vi.fn(),
    updateList: vi.fn(),
  }),
}))

vi.mock("@/hooks/use-preferences", () => ({
  usePreferences: () => ({
    isLoading: false,
    preferences: DEFAULT_PREFERENCES,
    updatePreference: vi.fn(),
  }),
}))

vi.mock("@/hooks/use-trailer", () => ({
  useTrailer: () => ({
    activeTrailer: null,
    closeTrailer: vi.fn(),
    isOpen: false,
    loadingMediaId: null,
    watchTrailer: vi.fn(),
  }),
}))

vi.mock("@hugeicons/react", () => ({
  HugeiconsIcon: () => <svg />,
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
  useSearchParams: () => mockSearchParams,
}))

const movieGenres: Genre[] = [{ id: 28, name: "Action" }]
const tvGenres: Genre[] = [{ id: 18, name: "Drama" }]
const languages: TMDBLanguage[] = [
  { english_name: "English", iso_639_1: "en", name: "English" },
]
const providers: TMDBWatchProviderOption[] = [
  {
    display_priorities: { US: 1 },
    logo_path: "/netflix.png",
    provider_id: 8,
    provider_name: "Netflix",
  },
  {
    display_priorities: { US: 2 },
    logo_path: "/hulu.png",
    provider_id: 15,
    provider_name: "Hulu",
  },
]
const initialResults: TMDBDiscoverResponse = {
  page: 1,
  results: [
    {
      adult: false,
      backdrop_path: null,
      genre_ids: [28],
      id: 1,
      media_type: "movie",
      original_language: "en",
      overview: "A movie",
      popularity: 100,
      poster_path: null,
      release_date: "2024-01-01",
      title: "Test Movie",
      vote_average: 8,
      vote_count: 100,
    },
  ],
  total_pages: 1,
  total_results: 1,
}

async function renderDiscoverClient({
  provider = null,
}: {
  provider?: number | null
} = {}) {
  const { DiscoverClient } = await import("@/app/discover/discover-client")

  render(
    <DiscoverClient
      initialFilters={{
        genre: null,
        language: null,
        mediaType: "movie",
        page: 1,
        provider,
        rating: null,
        sortBy: "popularity",
        year: null,
      }}
      initialResults={initialResults}
      languages={languages}
      movieGenres={movieGenres}
      providers={providers}
      tvGenres={tvGenres}
    />,
  )
}

describe("DiscoverClient streaming filter", () => {
  beforeEach(() => {
    pushMock.mockReset()
    mockSearchParams = new URLSearchParams()
    mockAuthState = {
      loading: false,
      premiumStatus: "free",
      user: null,
    }
  })

  it("renders the streaming filter without premium labeling", async () => {
    await renderDiscoverClient()

    expect(screen.getByLabelText("Streaming")).toBeInTheDocument()
    expect(screen.queryByText("Premium")).not.toBeInTheDocument()
  })

  it("lets guests select a streaming provider", async () => {
    await renderDiscoverClient()
    const user = userEvent.setup()

    await user.selectOptions(screen.getByLabelText("Streaming"), "8")

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/discover?provider=8")
    })
  })

  it("lets signed-in free users select a streaming provider", async () => {
    mockAuthState = {
      loading: false,
      premiumStatus: "free",
      user: { isAnonymous: false, uid: "user-1" },
    }

    await renderDiscoverClient()
    const user = userEvent.setup()

    await user.selectOptions(screen.getByLabelText("Streaming"), "15")

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/discover?provider=15")
    })
  })

  it("preserves an initial provider filter instead of clearing it on mount", async () => {
    mockSearchParams = new URLSearchParams("provider=8")

    await renderDiscoverClient({ provider: 8 })

    expect(screen.getByLabelText("Streaming")).toHaveValue("8")
    expect(pushMock).not.toHaveBeenCalled()
  })
})
