import { AddToListModal } from "@/components/add-to-list-modal"
import { render, screen, waitFor } from "@/test/utils"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  addToList: vi.fn(),
  createList: vi.fn(),
  deleteList: vi.fn(),
  lists: [],
  preferences: {
    showOriginalTitles: false,
  },
  removeFromList: vi.fn(),
  renameList: vi.fn(),
  restoreList: vi.fn(),
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
  restoreList: (...args: unknown[]) => mocks.restoreList(...args),
}))

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({
    open,
    children,
  }: {
    open: boolean
    children: ReactNode
  }) => (open ? <div>{children}</div> : null),
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
  DialogTitle: ({ children }: { children: ReactNode }) => (
    <h2>{children}</h2>
  ),
}))

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => mocks.toastSuccess(...args),
    error: vi.fn(),
    info: vi.fn(),
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
    mocks.restoreList.mockResolvedValue(undefined)
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

  it("undoes custom list creation from the success toast action", async () => {
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
    await user.type(screen.getByPlaceholderText("List name"), "Favorites")
    await user.click(screen.getByRole("button", { name: "Create" }))

    await waitFor(() => {
      expect(mocks.toastSuccess).toHaveBeenCalled()
    })

    const toastOptions = mocks.toastSuccess.mock.calls[0]?.[1] as
      | { action?: { onClick: () => void } }
      | undefined

    toastOptions?.action?.onClick()

    expect(mocks.deleteList).toHaveBeenCalledWith("new-list")
  })
})
