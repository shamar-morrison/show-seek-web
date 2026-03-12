import { ListsPageClient } from "@/components/lists-page-client"
import { render, screen } from "@/test/utils"
import type { UserList } from "@/types/list"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  preferences: {
    showOriginalTitles: true,
  },
  watchTrailer: vi.fn(),
  closeTrailer: vi.fn(),
}))

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
  }: {
    onSortChange: (state: { field: string; direction: string }) => void
  }) => (
    <button
      type="button"
      onClick={() => onSortChange({ field: "title", direction: "asc" })}
    >
      Sort title
    </button>
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

describe("ListsPageClient", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.preferences.showOriginalTitles = true
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
})
