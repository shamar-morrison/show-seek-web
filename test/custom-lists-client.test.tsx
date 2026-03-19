import { CustomListsClient } from "@/app/lists/custom-lists/custom-lists-client"
import { render, screen, waitFor } from "@/test/utils"
import type { UserList } from "@/types/list"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  lists: [] as UserList[],
  removeList: vi.fn(),
  restoreList: vi.fn(),
  showActionableSuccessToast: vi.fn(),
  toastError: vi.fn(),
  toastWarning: vi.fn(),
  updateList: vi.fn(),
}))

vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({
    user: { uid: "user-1" },
  }),
}))

vi.mock("@/hooks/use-lists", () => ({
  useLists: () => ({
    error: null,
    lists: mocks.lists,
    loading: false,
    removeList: mocks.removeList,
    updateList: mocks.updateList,
  }),
}))

vi.mock("@/components/lists-page-client", () => ({
  ListsPageClient: ({
    headerAction,
  }: {
    headerAction?: ReactNode
  }) => <div>{headerAction}</div>,
}))

vi.mock("@/components/create-list-dialog", () => ({
  CreateListDialog: () => null,
}))

vi.mock("@/components/ui/action-menu", () => ({
  ActionMenu: ({
    items,
  }: {
    items: Array<{
      type: string
      key: string
      label?: string
      onClick?: () => void
    }>
  }) => (
    <div>
      {items.map((item) =>
        item.type === "action" ? (
          <button key={item.key} type="button" onClick={item.onClick}>
            {item.label}
          </button>
        ) : null,
      )}
    </div>
  ),
}))

vi.mock("@/lib/actionable-toast", () => ({
  showActionableSuccessToast: (...args: unknown[]) =>
    mocks.showActionableSuccessToast(...args),
}))

vi.mock("@/lib/firebase/lists", () => ({
  restoreList: (...args: unknown[]) => mocks.restoreList(...args),
}))

vi.mock("@/hooks/use-preferences", () => ({
  usePreferences: () => ({
    preferences: {
      showOriginalTitles: false,
    },
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

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) =>
    open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}))

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => mocks.toastError(...args),
    warning: (...args: unknown[]) => mocks.toastWarning(...args),
  },
}))

function createCustomList(): UserList {
  return {
    id: "road-trip",
    name: "Road Trip",
    description: "Weekend plans",
    createdAt: 0,
    items: {},
    isCustom: true,
  }
}

describe("CustomListsClient", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.lists = [createCustomList()]
    mocks.updateList.mockResolvedValue(undefined)
    mocks.removeList.mockResolvedValue(undefined)
    mocks.restoreList.mockResolvedValue(true)
  })

  it("passes both the edited name and description through the action menu edit flow", async () => {
    const user = userEvent.setup()

    render(
      <CustomListsClient movieGenres={[]} tvGenres={[]} />,
    )

    await user.click(screen.getByRole("button", { name: "Edit List Details" }))

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
})
