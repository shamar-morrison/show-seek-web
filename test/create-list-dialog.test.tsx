import { CreateListDialog } from "@/components/create-list-dialog"
import { render, screen, waitFor } from "@/test/utils"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  createList: vi.fn(),
  deleteList: vi.fn(),
  showActionableSuccessToast: vi.fn(),
  toastError: vi.fn(),
  toastInfo: vi.fn(),
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
    createList: mocks.createList,
    deleteList: mocks.deleteList,
  }),
}))

vi.mock("@/lib/actionable-toast", () => ({
  showActionableSuccessToast: (...args: unknown[]) =>
    mocks.showActionableSuccessToast(...args),
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

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => mocks.toastError(...args),
    info: (...args: unknown[]) => mocks.toastInfo(...args),
  },
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

describe("CreateListDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createList.mockResolvedValue("new-list")
    mocks.deleteList.mockResolvedValue(undefined)
  })

  it("passes the description through when creating a custom list", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()

    render(<CreateListDialog open={true} onOpenChange={onOpenChange} />)

    await user.type(screen.getByLabelText("List name"), "Road Trip")
    await user.type(
      screen.getByLabelText("Description (optional)"),
      "Weekend plans",
    )
    await user.click(screen.getByRole("button", { name: "Create" }))

    await waitFor(() => {
      expect(mocks.createList).toHaveBeenCalledWith("Road Trip", "Weekend plans")
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })
  })

  it("inserts the selected emoji at the cursor position in the list name", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()

    render(<CreateListDialog open={true} onOpenChange={onOpenChange} />)

    const nameInput = screen.getByLabelText("List name")
    await user.type(nameInput, "Spooky watchlist")
    ;(nameInput as HTMLInputElement).setSelectionRange(6, 6)

    await user.click(screen.getByRole("button", { name: "Add emoji" }))
    await user.click(await screen.findByRole("button", { name: "Insert 👻" }))

    expect(nameInput).toHaveValue("Spooky👻 watchlist")
  })

  it("inserts the selected emoji into the last-focused field", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()

    render(<CreateListDialog open={true} onOpenChange={onOpenChange} />)

    const nameInput = screen.getByLabelText("List name")
    const description = screen.getByLabelText("Description (optional)")
    await user.type(nameInput, "Spooky")
    await user.click(description)
    await user.type(description, "Weekend plans")

    await user.click(screen.getByRole("button", { name: "Add emoji" }))
    await user.click(await screen.findByRole("button", { name: "Insert 🍿" }))

    expect(nameInput).toHaveValue("Spooky")
    expect(description).toHaveValue("Weekend plans🍿")
  })

  it("blocks description emoji inserts that would exceed the character limit", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()

    render(<CreateListDialog open={true} onOpenChange={onOpenChange} />)

    const description = screen.getByLabelText(
      "Description (optional)",
    ) as HTMLTextAreaElement
    await user.type(description, "a".repeat(119))

    await user.click(screen.getByRole("button", { name: "Add emoji" }))
    await user.click(await screen.findByRole("button", { name: "Insert 🔥" }))

    // 🔥 counts as 2 UTF-16 units, so 119 + 2 > 120 and the insert is capped
    expect(description).toHaveValue("a".repeat(119))
  })
})
