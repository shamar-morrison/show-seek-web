import { AddToListModal } from "@/components/add-to-list-modal"
import type { UserList } from "@/types/list"
import { render, screen, waitFor, within } from "@/test/utils"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { act } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  addToList: vi.fn(),
  createList: vi.fn(),
  deleteList: vi.fn(),
  fetchUserList: vi.fn(),
  lists: [] as UserList[],
  preferences: {
    copyInsteadOfMove: false,
    showOriginalTitles: false,
  },
  removeFromList: vi.fn(),
  updateList: vi.fn(),
  restoreList: vi.fn(),
  toastError: vi.fn(),
  toastInfo: vi.fn(),
  toastSuccess: vi.fn(),
  transferItems: vi.fn(),
}))

vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({
    user: { uid: "user-1" },
    premiumLoading: false,
    premiumStatus: "free",
  }),
}))

vi.mock("@/hooks/use-list-mutations", () => ({
  useListMutations: () => ({
    addToList: mocks.addToList,
    removeFromList: mocks.removeFromList,
    createList: mocks.createList,
    updateList: mocks.updateList,
    renameList: mocks.updateList,
    deleteList: mocks.deleteList,
  }),
}))

vi.mock("@/hooks/use-bulk-list-operations", () => ({
  useBulkListOperations: () => ({
    transferItems: mocks.transferItems,
  }),
}))

vi.mock("@/hooks/use-lists", () => ({
  useLists: () => ({
    lists: mocks.lists,
    loading: false,
  }),
}))

vi.mock("@/hooks/use-preferences", () => ({
  usePreferences: () => ({
    preferences: mocks.preferences,
  }),
}))

vi.mock("@/lib/premium-gating", () => ({
  PREMIUM_LOADING_MESSAGE: "Loading premium status.",
  isPremiumStatusPending: () => false,
  shouldEnforcePremiumLock: () => false,
}))

vi.mock("@/lib/premium-telemetry", () => ({
  createPremiumTelemetryPayload: vi.fn(() => ({})),
  trackPremiumEvent: vi.fn(),
}))

vi.mock("@/lib/firebase/lists", () => ({
  fetchUserList: (...args: unknown[]) => mocks.fetchUserList(...args),
  restoreList: (...args: unknown[]) => mocks.restoreList(...args),
}))

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) =>
    open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogDescription: ({ children }: { children: ReactNode }) => (
    <p>{children}</p>
  ),
  DialogFooter: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogHeader: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}))

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => mocks.toastSuccess(...args),
    error: (...args: unknown[]) => mocks.toastError(...args),
    info: (...args: unknown[]) => mocks.toastInfo(...args),
  },
}))

function createMedia() {
  return {
    id: 123,
    title: "Spirited Away",
    original_title: "Sen to Chihiro no Kamikakushi",
    poster_path: null,
    backdrop_path: null,
    overview: "",
    genre_ids: [],
    popularity: 0,
    vote_average: 0,
    vote_count: 0,
    release_date: "2001-07-20",
    media_type: "movie" as const,
    adult: false,
    original_language: "ja",
  }
}

function createListItem(id = 123) {
  return {
    id,
    title: "Spirited Away",
    poster_path: null,
    media_type: "movie" as const,
    addedAt: 111,
  }
}

describe("AddToListModal", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.lists = []
    mocks.preferences.copyInsteadOfMove = false
    mocks.preferences.showOriginalTitles = false
    mocks.createList.mockResolvedValue("new-list")
    mocks.addToList.mockResolvedValue(true)
    mocks.removeFromList.mockResolvedValue(undefined)
    mocks.updateList.mockResolvedValue(undefined)
    mocks.deleteList.mockResolvedValue(undefined)
    mocks.fetchUserList.mockResolvedValue(null)
    mocks.restoreList.mockResolvedValue(true)
    mocks.transferItems.mockResolvedValue({
      failedOperations: 0,
      totalOperations: 1,
    })
  })

  it("uses the latest display title in the save toast after preferences change", async () => {
    const user = userEvent.setup()
    mocks.lists = [
      {
        id: "watchlist",
        name: "Should Watch",
        items: {},
        createdAt: 0,
        isCustom: false,
      },
    ]
    const { rerender } = render(
      <AddToListModal
        isOpen={true}
        onClose={vi.fn()}
        media={createMedia()}
        mediaType="movie"
      />,
    )

    await user.click(screen.getByText("Should Watch"))
    await user.click(screen.getByRole("button", { name: "Save" }))

    await waitFor(() => {
      expect(mocks.toastSuccess).toHaveBeenCalledWith(
        "Updated lists for Spirited Away",
        expect.anything(),
      )
    })

    mocks.preferences.showOriginalTitles = true
    rerender(
      <AddToListModal
        isOpen={true}
        onClose={vi.fn()}
        media={createMedia()}
        mediaType="movie"
      />,
    )

    await user.click(screen.getByText("Should Watch"))
    await user.click(screen.getByRole("button", { name: "Save" }))

    await waitFor(() => {
      expect(mocks.toastSuccess).toHaveBeenLastCalledWith(
        "Updated lists for Sen to Chihiro no Kamikakushi",
        expect.anything(),
      )
    })
  })

  it("uses the latest display title in the create-list toast after preferences change", async () => {
    const user = userEvent.setup()
    const { rerender } = render(
      <AddToListModal
        isOpen={true}
        onClose={vi.fn()}
        media={createMedia()}
        mediaType="movie"
      />,
    )

    await user.click(screen.getByRole("button", { name: "Create List" }))
    await user.type(screen.getByPlaceholderText("List name"), "Favorites")
    await user.click(screen.getByRole("button", { name: "Create" }))

    await waitFor(() => {
      expect(mocks.toastSuccess).toHaveBeenCalledWith(
        'Created "Favorites" and added Spirited Away',
        expect.objectContaining({
          action: expect.objectContaining({
            label: "Undo",
            onClick: expect.any(Function),
          }),
        }),
      )
    })

    mocks.preferences.showOriginalTitles = true
    rerender(
      <AddToListModal
        isOpen={true}
        onClose={vi.fn()}
        media={createMedia()}
        mediaType="movie"
      />,
    )

    await user.click(screen.getByRole("button", { name: "Create List" }))
    await user.type(screen.getByPlaceholderText("List name"), "Classics")
    await user.click(screen.getByRole("button", { name: "Create" }))

    await waitFor(() => {
      expect(mocks.toastSuccess).toHaveBeenLastCalledWith(
        'Created "Classics" and added Sen to Chihiro no Kamikakushi',
        expect.objectContaining({
          action: expect.objectContaining({
            label: "Undo",
            onClick: expect.any(Function),
          }),
        }),
      )
    })
  })

  it("passes the description through when creating a list from the modal", async () => {
    const user = userEvent.setup()

    render(
      <AddToListModal
        isOpen={true}
        onClose={vi.fn()}
        media={createMedia()}
        mediaType="movie"
      />,
    )

    await user.click(screen.getByRole("button", { name: "Create List" }))
    await user.type(screen.getByLabelText("List name"), "Favorites")
    await user.type(
      screen.getByLabelText("Description (optional)"),
      "Weekend picks",
    )
    await user.click(screen.getByRole("button", { name: "Create" }))

    await waitFor(() => {
      expect(mocks.createList).toHaveBeenCalledWith(
        "Favorites",
        "Weekend picks",
      )
    })
  })

  it("passes both the edited name and description through when updating a list from the manage modal", async () => {
    const user = userEvent.setup()
    mocks.lists = [
      {
        id: "road-trip",
        name: "Road Trip",
        description: "Weekend plans",
        items: {
          "123": createListItem(),
        },
        createdAt: 1,
        isCustom: true,
      },
    ]

    render(
      <AddToListModal
        isOpen={true}
        onClose={vi.fn()}
        media={createMedia()}
        mediaType="movie"
      />,
    )

    await user.click(screen.getByRole("button", { name: "Manage" }))

    const row = screen.getByTestId("custom-list-row-road-trip")
    await user.click(within(row).getAllByRole("button")[0])

    await user.clear(screen.getByLabelText("List name"))
    await user.type(screen.getByLabelText("List name"), "Desert Escape")
    await user.clear(screen.getByLabelText("Description (optional)"))
    await user.type(
      screen.getByLabelText("Description (optional)"),
      "Sand and sunsets",
    )
    await user.click(screen.getByRole("button", { name: "Save Changes" }))

    await waitFor(() => {
      expect(mocks.updateList).toHaveBeenCalledWith(
        "road-trip",
        "Desert Escape",
        "Sand and sunsets",
      )
    })
  })

  it("runs the bulk copy flow, excludes the source list, and hides manage actions", async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const onComplete = vi.fn()
    const mediaItem = createListItem()
    mocks.lists = [
      {
        id: "watchlist",
        name: "Should Watch",
        items: {
          "123": mediaItem,
        },
        createdAt: 0,
        isCustom: false,
      },
      {
        id: "favorites",
        name: "Favorites",
        items: {},
        createdAt: 1,
        isCustom: false,
      },
      {
        id: "classics",
        name: "Classics",
        items: {},
        createdAt: 2,
        isCustom: true,
      },
    ]

    render(
      <AddToListModal
        isOpen={true}
        onClose={onClose}
        onComplete={onComplete}
        mediaItems={[mediaItem]}
        sourceListId="watchlist"
        bulkAddMode="copy"
      />,
    )

    expect(
      screen.getByRole("heading", { name: "Copy to Lists" }),
    ).toBeInTheDocument()
    expect(screen.getByText("1 selected item")).toBeInTheDocument()
    expect(screen.queryByText("Should Watch")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Manage" })).not.toBeInTheDocument()

    const saveButton = screen.getByRole("button", { name: "Save" })
    expect(saveButton).toBeDisabled()

    await user.click(screen.getByRole("button", { name: "Custom Lists" }))
    await user.click(screen.getByText("Classics"))
    expect(saveButton).toBeEnabled()

    await user.click(saveButton)

    await waitFor(() => {
      expect(mocks.transferItems).toHaveBeenCalledWith({
        sourceListId: "watchlist",
        targetListIds: ["classics"],
        mediaItems: [mediaItem],
        mode: "copy",
      })
    })

    expect(mocks.toastSuccess).toHaveBeenCalledWith("Items copied to lists")
    expect(onClose).toHaveBeenCalled()
    expect(onComplete).toHaveBeenCalled()
  })

  it("keeps the bulk modal open and shows an inline error after a partial failure", async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const onComplete = vi.fn()
    mocks.transferItems.mockResolvedValue({
      failedOperations: 1,
      totalOperations: 3,
    })
    mocks.lists = [
      {
        id: "watchlist",
        name: "Should Watch",
        items: {
          "123": createListItem(),
        },
        createdAt: 0,
        isCustom: false,
      },
      {
        id: "favorites",
        name: "Favorites",
        items: {},
        createdAt: 1,
        isCustom: false,
      },
    ]

    render(
      <AddToListModal
        isOpen={true}
        onClose={onClose}
        onComplete={onComplete}
        mediaItems={[createListItem()]}
        sourceListId="watchlist"
        bulkAddMode="move"
      />,
    )

    await user.click(screen.getByText("Favorites"))
    await user.click(screen.getByRole("button", { name: "Save" }))

    await waitFor(() => {
      expect(
        screen.getByText("Failed to save 1 of 3 changes."),
      ).toBeInTheDocument()
    })

    expect(
      screen.getByRole("heading", { name: "Move to Lists" }),
    ).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
    expect(onComplete).not.toHaveBeenCalled()
  })

  it("tells the user list deletion can be undone from the success toast", async () => {
    const user = userEvent.setup()
    mocks.lists = [
      {
        id: "road-trip",
        name: "Road Trip",
        items: {
          "123": createListItem(),
        },
        createdAt: 1,
        isCustom: true,
      },
    ]

    render(
      <AddToListModal
        isOpen={true}
        onClose={vi.fn()}
        media={createMedia()}
        mediaType="movie"
      />,
    )

    await user.click(screen.getByRole("button", { name: "Manage" }))

    const row = screen.getByTestId("custom-list-row-road-trip")

    await user.click(within(row).getAllByRole("button")[1])

    expect(
      screen.getByText(/you can undo this from the success toast/i),
    ).toBeInTheDocument()
    expect(screen.queryByText(/cannot be undone/i)).not.toBeInTheDocument()
  })

  it("shows a neutral info toast when delete undo is skipped", async () => {
    const user = userEvent.setup()
    mocks.lists = [
      {
        id: "road-trip",
        name: "Road Trip",
        items: {
          "123": createListItem(),
        },
        createdAt: 1,
        isCustom: true,
      },
    ]
    mocks.restoreList.mockResolvedValue(false)

    render(
      <AddToListModal
        isOpen={true}
        onClose={vi.fn()}
        media={createMedia()}
        mediaType="movie"
      />,
    )

    await user.click(screen.getByRole("button", { name: "Manage" }))

    const row = screen.getByTestId("custom-list-row-road-trip")

    await user.click(within(row).getAllByRole("button")[1])
    await user.click(screen.getByRole("button", { name: "Delete" }))

    await waitFor(() => {
      expect(mocks.toastSuccess).toHaveBeenCalledWith(
        'Deleted "Road Trip"',
        expect.objectContaining({
          action: expect.objectContaining({
            label: "Undo",
            onClick: expect.any(Function),
          }),
        }),
      )
    })

    const toastOptions = mocks.toastSuccess.mock.calls[0]?.[1] as
      | { action?: { onClick: () => void } }
      | undefined

    await act(async () => {
      await toastOptions?.action?.onClick()
    })

    expect(mocks.restoreList).toHaveBeenCalledWith("user-1", {
      id: "road-trip",
      name: "Road Trip",
      items: {
        "123": createListItem(),
      },
      createdAt: 1,
      isCustom: true,
    })
    expect(mocks.toastInfo).toHaveBeenCalledWith("List was not restored.")
  })

  it("undoes custom list creation by deleting an unchanged just-created list", async () => {
    const user = userEvent.setup()
    mocks.fetchUserList.mockResolvedValue({
      id: "new-list",
      name: "Favorites",
      items: {
        "123": createListItem(),
      },
      createdAt: 1,
      isCustom: true,
    })

    render(
      <AddToListModal
        isOpen={true}
        onClose={vi.fn()}
        media={createMedia()}
        mediaType="movie"
      />,
    )

    await user.click(screen.getByRole("button", { name: "Create List" }))
    await user.type(screen.getByPlaceholderText("List name"), "Favorites")
    await user.click(screen.getByRole("button", { name: "Create" }))

    await waitFor(() => {
      expect(mocks.toastSuccess).toHaveBeenCalled()
    })

    const toastOptions = mocks.toastSuccess.mock.calls[0]?.[1] as
      | { action?: { onClick: () => void } }
      | undefined

    await act(async () => {
      await toastOptions?.action?.onClick()
    })

    expect(mocks.fetchUserList).toHaveBeenCalledWith("user-1", "new-list")
    expect(mocks.deleteList).toHaveBeenCalledWith("new-list")
    expect(mocks.removeFromList).not.toHaveBeenCalled()
  })

  it("undoes custom list creation by removing only the original item when the list changed", async () => {
    const user = userEvent.setup()
    mocks.fetchUserList.mockResolvedValue({
      id: "new-list",
      name: "Favorites Renamed",
      items: {
        "123": createListItem(),
      },
      createdAt: 1,
      isCustom: true,
    })

    render(
      <AddToListModal
        isOpen={true}
        onClose={vi.fn()}
        media={createMedia()}
        mediaType="movie"
      />,
    )

    await user.click(screen.getByRole("button", { name: "Create List" }))
    await user.type(screen.getByPlaceholderText("List name"), "Favorites")
    await user.click(screen.getByRole("button", { name: "Create" }))

    await waitFor(() => {
      expect(mocks.toastSuccess).toHaveBeenCalled()
    })

    const toastOptions = mocks.toastSuccess.mock.calls[0]?.[1] as
      | { action?: { onClick: () => void } }
      | undefined

    await act(async () => {
      await toastOptions?.action?.onClick()
    })

    expect(mocks.fetchUserList).toHaveBeenCalledWith("user-1", "new-list")
    expect(mocks.removeFromList).toHaveBeenCalledWith("new-list", "123")
    expect(mocks.deleteList).not.toHaveBeenCalled()
  })

  it("shows an info toast instead of a success toast when there are no changes to save", async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    mocks.lists = [
      {
        id: "watchlist",
        name: "Should Watch",
        items: {},
        createdAt: 0,
        isCustom: false,
      },
    ]

    render(
      <AddToListModal
        isOpen={true}
        onClose={onClose}
        media={createMedia()}
        mediaType="movie"
      />,
    )

    await user.click(screen.getByRole("button", { name: "Save" }))

    await waitFor(() => {
      expect(mocks.toastInfo).toHaveBeenCalledWith("No changes to save")
    })

    expect(mocks.toastSuccess).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it("rolls back partial save failures and shows a detailed error", async () => {
    const user = userEvent.setup()
    const removeError = new Error("remove failed")
    mocks.lists = [
      {
        id: "watchlist",
        name: "Should Watch",
        items: {},
        createdAt: 0,
        isCustom: false,
      },
      {
        id: "classics",
        name: "Classics",
        items: {
          "123": createListItem(),
        },
        createdAt: 1,
        isCustom: true,
      },
    ]
    mocks.removeFromList
      .mockRejectedValueOnce(removeError)
      .mockResolvedValueOnce(undefined)

    render(
      <AddToListModal
        isOpen={true}
        onClose={vi.fn()}
        media={createMedia()}
        mediaType="movie"
      />,
    )

    await user.click(screen.getByText("Should Watch"))
    await user.click(screen.getByRole("button", { name: "Custom Lists" }))
    await user.click(screen.getByText("Classics"))
    await user.click(screen.getByRole("button", { name: "Save" }))

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith(
        'Failed to update "Classics". Any earlier changes were rolled back.',
      )
    })

    expect(mocks.addToList).toHaveBeenCalledWith(
      "watchlist",
      expect.objectContaining({
        id: 123,
        title: "Spirited Away",
      }),
    )
    expect(mocks.removeFromList).toHaveBeenNthCalledWith(1, "classics", "123")
    expect(mocks.removeFromList).toHaveBeenNthCalledWith(2, "watchlist", "123")
  })

  it("preserves addedAt when rolling back a removal after a later failure", async () => {
    const user = userEvent.setup()
    const addError = new Error("add failed")
    mocks.lists = [
      {
        id: "classics",
        name: "Classics",
        items: {
          "123": createListItem(),
        },
        createdAt: 1,
        isCustom: true,
      },
      {
        id: "watchlist",
        name: "Should Watch",
        items: {},
        createdAt: 0,
        isCustom: false,
      },
    ]
    mocks.addToList.mockRejectedValueOnce(addError).mockResolvedValueOnce(true)

    render(
      <AddToListModal
        isOpen={true}
        onClose={vi.fn()}
        media={createMedia()}
        mediaType="movie"
      />,
    )

    await user.click(screen.getByText("Should Watch"))
    await user.click(screen.getByRole("button", { name: "Custom Lists" }))
    await user.click(screen.getByText("Classics"))
    await user.click(screen.getByRole("button", { name: "Save" }))

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith(
        'Failed to update "Should Watch". Any earlier changes were rolled back.',
      )
    })

    expect(mocks.removeFromList).toHaveBeenCalledWith("classics", "123")
    expect(mocks.addToList).toHaveBeenNthCalledWith(
      1,
      "watchlist",
      expect.objectContaining({
        id: 123,
      }),
    )
    expect(mocks.addToList).toHaveBeenNthCalledWith(
      2,
      "classics",
      expect.objectContaining({
        id: 123,
        addedAt: 111,
      }),
    )
  })
})
