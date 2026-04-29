import { CustomListsClient } from "@/app/lists/custom-lists/custom-lists-client"
import { render, screen, waitFor } from "@/test/utils"
import type { UserList } from "@/types/list"
import userEvent from "@testing-library/user-event"
import { useState, type ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  deleteListsBatch: vi.fn(),
  lists: [] as UserList[],
  removeList: vi.fn(),
  restoreList: vi.fn(),
  showActionableSuccessToast: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
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

vi.mock("@/hooks/use-bulk-list-operations", () => ({
  useBulkListOperations: () => ({
    deleteListsBatch: mocks.deleteListsBatch,
  }),
}))

vi.mock("@/components/lists-page-client", () => ({
  ListsPageClient: ({
    filterRowAction,
    lists,
    selectedListId,
    showDefaultSelectAction = true,
  }: {
    filterRowAction?:
      | ReactNode
      | ((args: {
          activeList: UserList | undefined
          canSelectItems: boolean
          enterSelectionMode: () => void
          isSelectionMode: boolean
        }) => ReactNode)
    lists: UserList[]
    selectedListId?: string
    showDefaultSelectAction?: boolean
  }) => {
    const [selectionModeActive, setSelectionModeActive] = useState(false)
    const activeList =
      lists.find((list) => list.id === selectedListId) ?? lists[0]
    const canSelectItems = Object.keys(activeList?.items || {}).length > 0
    const resolvedFilterRowAction =
      typeof filterRowAction === "function"
        ? filterRowAction({
            activeList,
            canSelectItems,
            enterSelectionMode: () => setSelectionModeActive(true),
            isSelectionMode: selectionModeActive,
          })
        : filterRowAction

    return (
      <div>
        {resolvedFilterRowAction}
        {showDefaultSelectAction && canSelectItems ? (
          <button type="button" data-testid="default-select-button">
            Select
          </button>
        ) : null}
        {selectionModeActive ? <div>Selection mode active</div> : null}
      </div>
    )
  },
}))

vi.mock("@/components/create-list-dialog", () => ({
  CreateListDialog: () => null,
}))

vi.mock("@/components/ui/checkbox", () => ({
  Checkbox: ({
    checked,
    onCheckedChange,
  }: {
    checked?: boolean
    onCheckedChange?: (checked: boolean) => void
  }) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={(event) => onCheckedChange?.(event.target.checked)}
    />
  ),
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
      disabled?: boolean
      items?: Array<{
        type: string
        key: string
        label?: string
        onClick?: () => void
        disabled?: boolean
      }>
    }>
  }) => {
    const [openSubmenus, setOpenSubmenus] = useState<Record<string, boolean>>({})

    return (
      <div data-testid="action-menu">
        {items.map((item) => {
          if (item.type === "action") {
            return (
              <button key={item.key} type="button" onClick={item.onClick}>
                {item.label}
              </button>
            )
          }

          if (item.type === "submenu") {
            const isOpen = Boolean(openSubmenus[item.key])

            return (
              <div key={item.key}>
                <button
                  type="button"
                  onClick={() =>
                    setOpenSubmenus((prev) => ({
                      ...prev,
                      [item.key]: !prev[item.key],
                    }))
                  }
                >
                  {item.label}
                </button>
                {isOpen ? (
                  <div data-testid={`submenu-${item.key}`}>
                    {item.items?.map((submenuItem) =>
                      submenuItem.type === "action" ? (
                        <button
                          key={submenuItem.key}
                          type="button"
                          disabled={submenuItem.disabled}
                          onClick={submenuItem.onClick}
                        >
                          {submenuItem.label}
                        </button>
                      ) : null,
                    )}
                  </div>
                ) : null}
              </div>
            )
          }

          if (item.type === "separator") {
            return <div key={item.key} data-testid={`separator-${item.key}`} />
          }

          return null
        })}
      </div>
    )
  },
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
    success: (...args: unknown[]) => mocks.toastSuccess(...args),
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

function createSecondCustomList(): UserList {
  return {
    id: "date-night",
    name: "Date Night",
    description: "Friday picks",
    createdAt: 1,
    items: {
      "123": {
        id: 123,
        title: "Spirited Away",
        poster_path: null,
        media_type: "movie",
        addedAt: 111,
      },
    },
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
    mocks.deleteListsBatch.mockResolvedValue({
      deletedIds: [],
      failedIds: [],
    })
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

  it("hides standalone select buttons and places selection actions inside the overflow menu", async () => {
    const user = userEvent.setup()
    mocks.lists = [createCustomList(), createSecondCustomList()]

    render(<CustomListsClient movieGenres={[]} tvGenres={[]} />)

    expect(screen.queryByTestId("default-select-button")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Select Lists" }),
    ).not.toBeInTheDocument()

    const topLevelButtons = screen
      .getAllByTestId("action-menu")[0]
      ?.querySelectorAll("button")

    expect(Array.from(topLevelButtons ?? []).map((button) => button.textContent)).toEqual([
      "Edit List Details",
      "Select",
      "Delete List",
    ])

    await user.click(screen.getByRole("button", { name: "Select" }))

    expect(screen.getByRole("button", { name: "Select Items" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Select Lists" })).toBeInTheDocument()
  })

  it("enters item selection mode from the overflow submenu", async () => {
    const user = userEvent.setup()
    mocks.lists = [createSecondCustomList()]

    render(<CustomListsClient movieGenres={[]} tvGenres={[]} />)

    await user.click(screen.getByRole("button", { name: "Select" }))
    await user.click(screen.getByRole("button", { name: "Select Items" }))

    expect(screen.getByText("Selection mode active")).toBeInTheDocument()
  })

  it("disables selecting items when the active custom list has no items", async () => {
    const user = userEvent.setup()
    mocks.lists = [createCustomList()]

    render(<CustomListsClient movieGenres={[]} tvGenres={[]} />)

    await user.click(screen.getByRole("button", { name: "Select" }))

    expect(screen.getByRole("button", { name: "Select Items" })).toBeDisabled()
  })

  it("opens the bulk delete dialog and deletes the selected custom lists", async () => {
    const user = userEvent.setup()
    mocks.lists = [createCustomList(), createSecondCustomList()]
    mocks.deleteListsBatch.mockResolvedValue({
      deletedIds: ["road-trip", "date-night"],
      failedIds: [],
    })

    render(<CustomListsClient movieGenres={[]} tvGenres={[]} />)

    await user.click(screen.getByRole("button", { name: "Select" }))
    await user.click(screen.getByRole("button", { name: "Select Lists" }))

    expect(
      screen.getByRole("heading", { name: "Select custom lists to delete" }),
    ).toBeInTheDocument()

    const checkboxes = screen.getAllByRole("checkbox")
    await user.click(checkboxes[0]!)
    await user.click(checkboxes[1]!)
    await user.click(screen.getByRole("button", { name: "Delete selected lists" }))

    await waitFor(() => {
      expect(mocks.deleteListsBatch).toHaveBeenCalledWith({
        listIds: ["road-trip", "date-night"],
        onProgress: expect.any(Function),
      })
    })

    expect(mocks.toastSuccess).toHaveBeenCalledWith("2 lists deleted.")
  })

  it("keeps failed bulk deletions selected when only part of the batch succeeds", async () => {
    const user = userEvent.setup()
    mocks.lists = [createCustomList(), createSecondCustomList()]
    mocks.deleteListsBatch.mockResolvedValue({
      deletedIds: ["road-trip"],
      failedIds: ["date-night"],
    })

    render(<CustomListsClient movieGenres={[]} tvGenres={[]} />)

    await user.click(screen.getByRole("button", { name: "Select" }))
    await user.click(screen.getByRole("button", { name: "Select Lists" }))
    const checkboxes = screen.getAllByRole("checkbox")
    await user.click(checkboxes[0]!)
    await user.click(checkboxes[1]!)
    await user.click(screen.getByRole("button", { name: "Delete selected lists" }))

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Failed to delete 1 of 2 selected lists.",
      )
    })

    const updatedCheckboxes = screen.getAllByRole("checkbox")
    expect(updatedCheckboxes[1]).toBeChecked()
    expect(updatedCheckboxes[0]).not.toBeChecked()
  })
})
