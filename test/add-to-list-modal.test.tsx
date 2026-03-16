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
    showOriginalTitles: false,
  },
  removeFromList: vi.fn(),
  renameList: vi.fn(),
  restoreList: vi.fn(),
  toastError: vi.fn(),
  toastInfo: vi.fn(),
  toastSuccess: vi.fn(),
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
    renameList: mocks.renameList,
    deleteList: mocks.deleteList,
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
    mocks.preferences.showOriginalTitles = false
    mocks.createList.mockResolvedValue("new-list")
    mocks.addToList.mockResolvedValue(true)
    mocks.removeFromList.mockResolvedValue(undefined)
    mocks.renameList.mockResolvedValue(undefined)
    mocks.deleteList.mockResolvedValue(undefined)
    mocks.fetchUserList.mockResolvedValue(null)
    mocks.restoreList.mockResolvedValue(true)
  })

  it("uses the latest display title in the save toast after preferences change", async () => {
    const user = userEvent.setup()
    const { rerender } = render(
      <AddToListModal
        isOpen={true}
        onClose={vi.fn()}
        media={createMedia()}
        mediaType="movie"
      />,
    )

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

    const row = screen.getByText("Road Trip").closest("div")
    expect(row).not.toBeNull()

    await user.click(within(row as HTMLElement).getAllByRole("button")[1])

    expect(
      screen.getByText(/you can undo this from the success toast/i),
    ).toBeInTheDocument()
    expect(screen.queryByText(/cannot be undone/i)).not.toBeInTheDocument()
  })

  it("shows an info toast when delete undo is skipped because a newer list exists", async () => {
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

    const row = screen.getByText("Road Trip").closest("div")
    expect(row).not.toBeNull()

    await user.click(within(row as HTMLElement).getAllByRole("button")[1])
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
    expect(mocks.toastInfo).toHaveBeenCalledWith(
      "List was not restored because a newer version already exists.",
    )
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
})
