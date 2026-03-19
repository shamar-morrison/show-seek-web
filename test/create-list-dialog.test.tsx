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
})
