import { PremiumModal } from "@/components/premium-modal"
import { render, screen } from "@/test/utils"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) =>
    open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogDescription: ({ children }: { children: ReactNode }) => (
    <p>{children}</p>
  ),
  DialogHeader: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}))

const originalLocation = window.location

let mockAuthState: {
  user: { uid: string } | null
  isPremium: boolean
  premiumLoading: boolean
  premiumProvider: "polar" | "revenuecat" | null
  premiumSubscriptionState: string | null
} = {
  user: null,
  isPremium: false,
  premiumLoading: false,
  premiumProvider: null,
  premiumSubscriptionState: null,
}

vi.mock("@/context/auth-context", () => ({
  useAuth: () => mockAuthState,
}))

function mockLocationAssign(): string[] {
  const assignedHrefs: string[] = []
  Object.defineProperty(window, "location", {
    value: {},
    writable: true,
    configurable: true,
  })
  Object.defineProperty(window.location, "href", {
    get: () => "",
    set: (value: string) => {
      assignedHrefs.push(value)
    },
    configurable: true,
  })
  return assignedHrefs
}

function restoreLocation() {
  Object.defineProperty(window, "location", {
    value: originalLocation,
    writable: true,
    configurable: true,
  })
}

describe("PremiumModal", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    mockAuthState = {
      user: null,
      isPremium: false,
      premiumLoading: false,
      premiumProvider: null,
      premiumSubscriptionState: null,
    }
  })

  it("renders the benefit list with descriptions", () => {
    render(<PremiumModal open={true} onOpenChange={vi.fn()} />)

    expect(
      screen.getByRole("heading", { name: "Unlock ShowSeek Premium" }),
    ).toBeInTheDocument()
    expect(screen.getByText("Where to Watch for anything")).toBeInTheDocument()
    expect(
      screen.getByText("See where any movie or show is streaming right now."),
    ).toBeInTheDocument()
    expect(screen.getByText("Hide watched in Discover")).toBeInTheDocument()
    expect(screen.getByText("Latest trailers on Home")).toBeInTheDocument()
    expect(screen.getByText("Trakt sync and imports")).toBeInTheDocument()
    expect(screen.getByText("Plus much more to unlock")).toBeInTheDocument()
    expect(
      screen.getByText("New premium features are added regularly."),
    ).toBeInTheDocument()
    expect(screen.queryByText("Unlimited custom lists")).not.toBeInTheDocument()
    expect(screen.queryByText("ShowSeek Premium")).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Upgrade to Premium" }),
    ).toBeInTheDocument()
  })

  it("shows the hardcoded plan prices", () => {
    render(<PremiumModal open={true} onOpenChange={vi.fn()} />)

    expect(screen.getByText("$3.99")).toBeInTheDocument()
    expect(screen.getByText("$29.99")).toBeInTheDocument()
    expect(screen.getByText("Just $2.50/mo")).toBeInTheDocument()
    expect(screen.getByText("Best value")).toBeInTheDocument()
  })

  it("redirects to checkout with the yearly plan by default", async () => {
    const user = userEvent.setup()
    const assignedHrefs = mockLocationAssign()

    try {
      render(<PremiumModal open={true} onOpenChange={vi.fn()} />)

      await user.click(
        screen.getByRole("button", { name: "Upgrade to Premium" }),
      )
      expect(assignedHrefs).toEqual([
        "/api/billing/polar/checkout?plan=yearly",
      ])
    } finally {
      restoreLocation()
    }
  })

  it("redirects to checkout with the monthly plan when selected", async () => {
    const user = userEvent.setup()
    const assignedHrefs = mockLocationAssign()

    try {
      render(<PremiumModal open={true} onOpenChange={vi.fn()} />)

      await user.click(screen.getByText("Monthly"))
      await user.click(
        screen.getByRole("button", { name: "Upgrade to Premium" }),
      )
      expect(assignedHrefs).toEqual([
        "/api/billing/polar/checkout?plan=monthly",
      ])
    } finally {
      restoreLocation()
    }
  })

  it("shows the active-premium notice and disables checkout for Polar ACTIVE premium", async () => {
    mockAuthState = {
      user: { uid: "user-1" },
      isPremium: true,
      premiumLoading: false,
      premiumProvider: "polar",
      premiumSubscriptionState: "ACTIVE",
    }

    render(<PremiumModal open={true} onOpenChange={vi.fn()} />)

    expect(
      screen.getByText("You already have an active Premium subscription."),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Upgrade to Premium" }),
    ).toBeDisabled()
    expect(screen.getByText("Monthly").closest("button")).toBeDisabled()
    expect(screen.getByText("Annual").closest("button")).toBeDisabled()
  })

  it("shows the active-premium notice and disables checkout for RevenueCat premium", async () => {
    mockAuthState = {
      user: { uid: "user-1" },
      isPremium: true,
      premiumLoading: false,
      premiumProvider: "revenuecat",
      premiumSubscriptionState: "ACTIVE",
    }

    render(<PremiumModal open={true} onOpenChange={vi.fn()} />)

    expect(
      screen.getByText("You already have an active Premium subscription."),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Upgrade to Premium" }),
    ).toBeDisabled()
  })

  it("allows Polar CANCELLED grace-period resubscribe", async () => {
    const user = userEvent.setup()
    mockAuthState = {
      user: { uid: "user-1" },
      isPremium: true,
      premiumLoading: false,
      premiumProvider: "polar",
      premiumSubscriptionState: "CANCELLED",
    }
    const assignedHrefs = mockLocationAssign()

    try {
      render(<PremiumModal open={true} onOpenChange={vi.fn()} />)

      expect(
        screen.queryByText("You already have an active Premium subscription."),
      ).not.toBeInTheDocument()
      await user.click(
        screen.getByRole("button", { name: "Upgrade to Premium" }),
      )
      expect(assignedHrefs).toEqual([
        "/api/billing/polar/checkout?plan=yearly",
      ])
    } finally {
      restoreLocation()
    }
  })

  it("disables checkout while premium is loading, without the active text", async () => {
    mockAuthState = {
      user: { uid: "user-1" },
      isPremium: false,
      premiumLoading: true,
      premiumProvider: null,
      premiumSubscriptionState: null,
    }

    render(<PremiumModal open={true} onOpenChange={vi.fn()} />)

    expect(
      screen.queryByText("You already have an active Premium subscription."),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Upgrade to Premium" }),
    ).toBeDisabled()
  })
})
