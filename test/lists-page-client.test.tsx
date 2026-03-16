import { ListsPageClient } from "@/components/lists-page-client"
import { render, screen } from "@/test/utils"
import type { UserList } from "@/types/list"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  preferences: {
    showOriginalTitles: true,
  },
  watchTrailer: vi.fn(),
  closeTrailer: vi.fn(),
}))

const originalTimeZone = process.env.TZ

function restoreTimeZone() {
  if (originalTimeZone === undefined) {
    delete process.env.TZ
    return
  }

  process.env.TZ = originalTimeZone
}

vi.mock("@/hooks/use-preferences", () => ({
  usePreferences: () => ({
    preferences: mocks.preferences,
  }),
}))

vi.mock("@/hooks/use-trailer", () => ({
  useTrailer: () => ({
    isOpen: false,
    activeTrailer: null,
    loadingMediaId: null,
    watchTrailer: mocks.watchTrailer,
    closeTrailer: mocks.closeTrailer,
  }),
}))

vi.mock("@/components/ui/filter-sort", () => ({
  FilterSort: ({
    onSortChange,
    yearRange,
  }: {
    onSortChange: (state: { field: string; direction: string }) => void
    yearRange?: { onChange: (range: [number, number]) => void }
  }) => (
    <>
      <button
        type="button"
        onClick={() => onSortChange({ field: "title", direction: "asc" })}
      >
        Sort title
      </button>
      <button
        type="button"
        onClick={() =>
          onSortChange({ field: "release_date", direction: "asc" })
        }
      >
        Sort release
      </button>
      <button
        type="button"
        onClick={() => yearRange?.onChange([2024, 2024])}
      >
        Year 2024
      </button>
    </>
  ),
}))

vi.mock("@/components/media-card-with-actions", () => ({
  MediaCardWithActions: ({
    media,
  }: {
    media: {
      title?: string
      name?: string
      original_title?: string
      original_name?: string
    }
  }) => {
    const canonicalTitle = media.title ?? media.name ?? ""
    const originalTitle = media.original_title ?? media.original_name ?? ""
    const displayTitle = mocks.preferences.showOriginalTitles
      ? originalTitle || canonicalTitle
      : canonicalTitle || originalTitle

    return <div data-testid="media-card">{displayTitle}</div>
  },
}))

vi.mock("@/components/trailer-modal", () => ({
  TrailerModal: () => null,
}))

function createLists(): UserList[] {
  return [
    {
      id: "watchlist",
      name: "Should Watch",
      createdAt: 0,
      items: {
        123: {
          id: 123,
          title: "Spirited Away",
          original_title: "Sen to Chihiro no Kamikakushi",
          poster_path: null,
          media_type: "movie",
          vote_average: 8.5,
          release_date: "2001-07-20",
          addedAt: 2,
          genre_ids: [],
        },
        456: {
          id: 456,
          title: "Your Name",
          original_title: "Kimi no Na wa.",
          poster_path: null,
          media_type: "movie",
          vote_average: 8.2,
          release_date: "2016-08-26",
          addedAt: 1,
          genre_ids: [],
        },
      },
    },
  ]
}

function createJanBoundaryLists(): UserList[] {
  return [
    {
      id: "watchlist",
      name: "Should Watch",
      createdAt: 0,
      items: {
        10: {
          id: 10,
          title: "January First",
          original_title: "January First",
          poster_path: null,
          media_type: "movie",
          vote_average: 8.8,
          release_date: "2024-01-01",
          addedAt: 2,
          genre_ids: [],
        },
        11: {
          id: 11,
          title: "December Finale",
          original_title: "December Finale",
          poster_path: null,
          media_type: "movie",
          vote_average: 8.1,
          release_date: "2023-12-31",
          addedAt: 1,
          genre_ids: [],
        },
      },
    },
  ]
}

describe("ListsPageClient", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.preferences.showOriginalTitles = true
  })

  afterEach(() => {
    restoreTimeZone()
  })

  it("filters by the displayed list title", async () => {
    const user = userEvent.setup()

    render(
      <ListsPageClient
        lists={createLists()}
        loading={false}
        error={null}
      />,
    )

    await user.type(screen.getByPlaceholderText("Search in this list..."), "Kimi")

    expect(screen.getByText("Kimi no Na wa.")).toBeInTheDocument()
    expect(
      screen.queryByText("Sen to Chihiro no Kamikakushi"),
    ).not.toBeInTheDocument()
  })

  it("sorts alphabetically by the displayed list title", async () => {
    const user = userEvent.setup()

    render(
      <ListsPageClient
        lists={createLists()}
        loading={false}
        error={null}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Sort title" }))

    const cards = screen.getAllByTestId("media-card")
    expect(cards[0]).toHaveTextContent("Kimi no Na wa.")
    expect(cards[1]).toHaveTextContent("Sen to Chihiro no Kamikakushi")
  })

  it("keeps January 1 list items in the correct release year filter", async () => {
    process.env.TZ = "America/Jamaica"
    const user = userEvent.setup()

    render(
      <ListsPageClient
        lists={createJanBoundaryLists()}
        loading={false}
        error={null}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Year 2024" }))

    expect(screen.getByText("January First")).toBeInTheDocument()
    expect(screen.queryByText("December Finale")).not.toBeInTheDocument()
  })

  it("sorts list items by TMDB release dates without timezone drift", async () => {
    process.env.TZ = "America/Jamaica"
    const user = userEvent.setup()

    render(
      <ListsPageClient
        lists={createJanBoundaryLists()}
        loading={false}
        error={null}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Sort release" }))

    const cards = screen.getAllByTestId("media-card")
    expect(cards[0]).toHaveTextContent("December Finale")
    expect(cards[1]).toHaveTextContent("January First")
  })
})
