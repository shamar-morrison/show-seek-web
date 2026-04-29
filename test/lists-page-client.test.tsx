import { ListsPageClient } from "@/components/lists-page-client"
import { render, screen, waitFor, within } from "@/test/utils"
import type { UserList } from "@/types/list"
import userEvent from "@testing-library/user-event"
import type { ButtonHTMLAttributes, ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  preferences: {
    copyInsteadOfMove: false,
    showOriginalTitles: true,
  },
  addToListModalProps: null as Record<string, unknown> | null,
  bulkModalRenderCount: 0,
  removeItemsFromListBatch: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  watchTrailer: vi.fn(),
  closeTrailer: vi.fn(),
  shuffleDialog: vi.fn(),
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

vi.mock("@/hooks/use-bulk-list-operations", () => ({
  useBulkListOperations: () => ({
    removeItemsFromListBatch: mocks.removeItemsFromListBatch,
  }),
}))

vi.mock("@/components/ui/filter-sort", () => ({
  FilterSort: ({
    onFilterChange,
    ratingFilter,
    onSortChange,
    yearRange,
  }: {
    onFilterChange?: (key: string, value: string) => void
    ratingFilter?: { onChange: (value: number) => void }
    onSortChange: (state: { field: string; direction: string }) => void
    yearRange?: { onChange: (range: [number, number]) => void }
  }) => (
    <>
      <button type="button" onClick={() => onFilterChange?.("mediaType", "tv")}>
        Filter TV
      </button>
      <button type="button" onClick={() => ratingFilter?.onChange(9)}>
        Min rating 9
      </button>
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
    isSelected,
    onSelectToggle,
    selectionMode,
  }: {
    media: {
      title?: string
      name?: string
      original_title?: string
      original_name?: string
    }
    isSelected?: boolean
    onSelectToggle?: () => void
    selectionMode?: boolean
  }) => {
    const canonicalTitle = media.title ?? media.name ?? ""
    const originalTitle = media.original_title ?? media.original_name ?? ""
    const displayTitle = mocks.preferences.showOriginalTitles
      ? originalTitle || canonicalTitle
      : canonicalTitle || originalTitle

    if (selectionMode) {
      return (
        <button
          type="button"
          data-testid="media-card"
          aria-pressed={isSelected}
          onClick={onSelectToggle}
        >
          {displayTitle}
        </button>
      )
    }

    return <div data-testid="media-card">{displayTitle}</div>
  },
}))

vi.mock("@/components/add-to-list-modal", () => ({
  AddToListModal: (props: Record<string, unknown>) => {
    mocks.addToListModalProps = props
    mocks.bulkModalRenderCount += 1

    return props.isOpen ? <div data-testid="bulk-add-modal" /> : null
  },
}))

vi.mock("@/components/trailer-modal", () => ({
  TrailerModal: () => null,
}))

vi.mock("@/components/shuffle-dialog", () => ({
  ShuffleDialog: ({
    isOpen,
    items,
  }: {
    isOpen: boolean
    items: Array<{ id: number; title?: string; name?: string }>
  }) => {
    mocks.shuffleDialog({ isOpen, items })

    if (!isOpen) {
      return null
    }

    return (
      <div data-testid="shuffle-dialog">
        {items.map((item) => (
          <span key={item.id}>{item.title ?? item.name}</span>
        ))}
      </div>
    )
  },
}))

vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({
    open,
    children,
  }: {
    open: boolean
    children: ReactNode
  }) => (open ? <div data-testid="alert-dialog">{children}</div> : null),
  AlertDialogAction: ({
    children,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  AlertDialogCancel: ({
    children,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  AlertDialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: { children: ReactNode }) => (
    <p>{children}</p>
  ),
  AlertDialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}))

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) =>
    open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}))

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => mocks.toastError(...args),
    success: (...args: unknown[]) => mocks.toastSuccess(...args),
  },
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
    mocks.addToListModalProps = null
    mocks.bulkModalRenderCount = 0
    mocks.preferences.copyInsteadOfMove = false
    mocks.preferences.showOriginalTitles = true
    mocks.removeItemsFromListBatch.mockResolvedValue({
      failedItems: [],
      total: 0,
    })
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

  it("renders the active list description in the dynamic header", () => {
    render(
      <ListsPageClient
        lists={[
          {
            id: "road-trip",
            name: "Road Trip",
            description: "Weekend picks for the drive",
            createdAt: 0,
            items: {},
          },
        ]}
        loading={false}
        error={null}
        showDynamicHeader={true}
      />,
    )

    expect(
      screen.getByRole("heading", { name: "Road Trip" }),
    ).toBeInTheDocument()
    expect(screen.getByText("Weekend picks for the drive")).toBeInTheDocument()
  })

  it("shows a shuffle button when the action is enabled", () => {
    render(
      <ListsPageClient
        lists={createLists()}
        loading={false}
        error={null}
        showShuffleAction={true}
      />,
    )

    expect(
      screen.getByRole("button", { name: "Shuffle Pick" }),
    ).toBeInTheDocument()
  })

  it("disables shuffle when fewer than two visible items remain", async () => {
    const user = userEvent.setup()

    render(
      <ListsPageClient
        lists={createLists()}
        loading={false}
        error={null}
        showShuffleAction={true}
      />,
    )

    const shuffleButton = screen.getByRole("button", { name: "Shuffle Pick" })
    expect(shuffleButton).toBeEnabled()

    await user.type(screen.getByPlaceholderText("Search in this list..."), "Kimi")

    expect(shuffleButton).toBeDisabled()
  })

  it("passes the currently visible filtered items to shuffle", async () => {
    const user = userEvent.setup()

    render(
      <ListsPageClient
        lists={createLists()}
        loading={false}
        error={null}
        showShuffleAction={true}
      />,
    )

    await user.type(screen.getByPlaceholderText("Search in this list..."), "Spirited")
    await user.clear(screen.getByPlaceholderText("Search in this list..."))
    await user.click(screen.getByRole("button", { name: "Sort title" }))
    await user.click(screen.getByRole("button", { name: "Shuffle Pick" }))

    expect(screen.getByTestId("shuffle-dialog")).toBeInTheDocument()
    expect(screen.getByText("Kimi no Na wa.")).toBeInTheDocument()
    expect(screen.getByText("Sen to Chihiro no Kamikakushi")).toBeInTheDocument()

    const lastCall =
      mocks.shuffleDialog.mock.calls[mocks.shuffleDialog.mock.calls.length - 1]?.[0]
    expect(lastCall?.items).toHaveLength(2)
    expect(lastCall?.items[0]?.id).toBe(456)
    expect(lastCall?.items[1]?.id).toBe(123)
  })

  it("enters selection mode, disables list switching, and opens the bulk modal in move mode", async () => {
    const user = userEvent.setup()

    render(
      <ListsPageClient
        lists={createLists()}
        loading={false}
        error={null}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Select" }))

    expect(
      screen.getByText(/select items from "Should Watch" to move, copy, or remove them in bulk/i),
    ).toBeInTheDocument()
    expect(
      screen.queryByPlaceholderText("Search in this list..."),
    ).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Should Watch/i })).toBeDisabled()

    await user.click(
      screen.getByRole("button", {
        name: "Sen to Chihiro no Kamikakushi",
      }),
    )

    expect(screen.getByText("1 item selected")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Move to lists" }))

    expect(screen.getByTestId("bulk-add-modal")).toBeInTheDocument()
    expect(mocks.addToListModalProps).toEqual(
      expect.objectContaining({
        bulkAddMode: "move",
        isOpen: true,
        sourceListId: "watchlist",
      }),
    )
    expect(
      (mocks.addToListModalProps?.mediaItems as Array<{ id: number }>)?.map(
        (item) => item.id,
      ),
    ).toEqual([123])
  })

  it("uses the copy preference for the bulk primary action", async () => {
    const user = userEvent.setup()
    mocks.preferences.copyInsteadOfMove = true

    render(
      <ListsPageClient
        lists={createLists()}
        loading={false}
        error={null}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Select" }))

    expect(
      screen.getByRole("button", { name: "Copy to lists" }),
    ).toBeInTheDocument()
  })

  it("clears search and active filters before entering selection mode", async () => {
    const user = userEvent.setup()

    render(
      <ListsPageClient
        lists={createLists()}
        loading={false}
        error={null}
      />,
    )

    await user.type(screen.getByPlaceholderText("Search in this list..."), "Spirited")
    await user.click(screen.getByRole("button", { name: "Filter TV" }))
    await user.click(screen.getByRole("button", { name: "Min rating 9" }))

    expect(screen.queryAllByTestId("media-card")).toHaveLength(0)

    await user.click(screen.getByRole("button", { name: "Select" }))

    expect(
      screen.queryByPlaceholderText("Search in this list..."),
    ).not.toBeInTheDocument()
    expect(screen.getAllByTestId("media-card")).toHaveLength(2)
    expect(
      screen.getByRole("button", { name: "Sen to Chihiro no Kamikakushi" }),
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Kimi no Na wa." })).toBeInTheDocument()
  })

  it("supports a custom selection entry while hiding the built-in select button", async () => {
    const user = userEvent.setup()

    render(
      <ListsPageClient
        lists={createLists()}
        loading={false}
        error={null}
        showDefaultSelectAction={false}
        filterRowAction={({ canSelectItems, enterSelectionMode }) => (
          <button
            type="button"
            disabled={!canSelectItems}
            onClick={enterSelectionMode}
          >
            Menu Select Items
          </button>
        )}
      />,
    )

    expect(screen.queryByRole("button", { name: "Select" })).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Menu Select Items" }))

    expect(
      screen.getByText(/select items from "Should Watch" to move, copy, or remove them in bulk/i),
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Should Watch/i })).toBeDisabled()
  })

  it("clears search and filters before entering selection mode from a custom action", async () => {
    const user = userEvent.setup()

    render(
      <ListsPageClient
        lists={createLists()}
        loading={false}
        error={null}
        showDefaultSelectAction={false}
        filterRowAction={({ canSelectItems, enterSelectionMode }) => (
          <button
            type="button"
            disabled={!canSelectItems}
            onClick={enterSelectionMode}
          >
            Menu Select Items
          </button>
        )}
      />,
    )

    await user.type(screen.getByPlaceholderText("Search in this list..."), "Spirited")
    await user.click(screen.getByRole("button", { name: "Filter TV" }))
    await user.click(screen.getByRole("button", { name: "Min rating 9" }))

    expect(screen.queryAllByTestId("media-card")).toHaveLength(0)

    await user.click(screen.getByRole("button", { name: "Menu Select Items" }))

    expect(
      screen.queryByPlaceholderText("Search in this list..."),
    ).not.toBeInTheDocument()
    expect(screen.getAllByTestId("media-card")).toHaveLength(2)
    expect(
      screen.getByRole("button", { name: "Sen to Chihiro no Kamikakushi" }),
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Kimi no Na wa." })).toBeInTheDocument()
  })

  it("removes selected items in bulk and exits selection mode on success", async () => {
    const user = userEvent.setup()
    mocks.removeItemsFromListBatch.mockResolvedValue({
      failedItems: [],
      total: 1,
    })

    render(
      <ListsPageClient
        lists={createLists()}
        loading={false}
        error={null}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Select" }))
    await user.click(
      screen.getByRole("button", {
        name: "Sen to Chihiro no Kamikakushi",
      }),
    )
    await user.click(screen.getByRole("button", { name: "Remove items" }))

    expect(screen.getByTestId("alert-dialog")).toBeInTheDocument()

    await user.click(
      within(screen.getByTestId("alert-dialog")).getByRole("button", {
        name: "Remove items",
      }),
    )

    await waitFor(() => {
      expect(mocks.removeItemsFromListBatch).toHaveBeenCalledWith({
        listId: "watchlist",
        mediaItems: [
          expect.objectContaining({
            id: 123,
            media_type: "movie",
          }),
        ],
        onProgress: expect.any(Function),
      })
    })

    await waitFor(() => {
      expect(
        screen.queryByText("1 item selected"),
      ).not.toBeInTheDocument()
    })

    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "1 item removed from Should Watch.",
    )
    expect(
      screen.getByPlaceholderText("Search in this list..."),
    ).toBeInTheDocument()
  })

  it("keeps failed bulk removals selected", async () => {
    const user = userEvent.setup()
    mocks.removeItemsFromListBatch.mockResolvedValue({
      failedItems: ["movie-456"],
      total: 2,
    })

    render(
      <ListsPageClient
        lists={createLists()}
        loading={false}
        error={null}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Select" }))
    await user.click(
      screen.getByRole("button", {
        name: "Sen to Chihiro no Kamikakushi",
      }),
    )
    await user.click(screen.getByRole("button", { name: "Kimi no Na wa." }))
    await user.click(screen.getByRole("button", { name: "Remove items" }))

    await user.click(
      within(screen.getByTestId("alert-dialog")).getByRole("button", {
        name: "Remove items",
      }),
    )

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Failed to remove 1 of 2 selected items.",
      )
    })

    expect(screen.getByText("1 item selected")).toBeInTheDocument()
  })
})
