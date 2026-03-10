import { beforeEach, describe, expect, it, vi } from "vitest"
import userEvent from "@testing-library/user-event"
import { render, screen, within } from "./utils"

const updatePreferenceMock = vi.fn()
const signOutMock = vi.fn()

vi.mock("@/components/premium-modal", () => ({
  PremiumModal: () => null,
}))

vi.mock("@/components/profile/action-button", () => ({
  ActionButton: ({
    disabled,
    label,
    onClick,
  }: {
    disabled?: boolean
    label: string
    onClick?: () => void
  }) => (
    <button disabled={disabled} onClick={onClick} type="button">
      {label}
    </button>
  ),
}))

vi.mock("@/components/profile/export-data-modal", () => ({
  ExportDataModal: () => null,
}))

vi.mock("@/components/profile/HomeScreenCustomizer", () => ({
  HomeScreenCustomizer: () => null,
}))

vi.mock("@/components/ui/avatar", () => ({
  Avatar: ({ alt }: { alt: string }) => <div>{alt}</div>,
}))

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: string }) => <span>{children}</span>,
}))

vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({
    user: {
      uid: "user-1",
      displayName: "Test User",
      email: "test@example.com",
      photoURL: null,
    },
    loading: false,
    premiumLoading: false,
    premiumStatus: "free",
    signOut: signOutMock,
  }),
}))

vi.mock("@/hooks/use-preferences", async () => {
  const { DEFAULT_PREFERENCES } = await import("@/lib/user-preferences")

  return {
    usePreferences: () => ({
      preferences: DEFAULT_PREFERENCES,
      isLoading: false,
      updatePreference: updatePreferenceMock,
    }),
  }
})

vi.mock("@/lib/premium-gating", () => ({
  PREMIUM_LOADING_MESSAGE: "Checking premium status",
  isPremiumStatusPending: () => false,
  shouldEnforcePremiumLock: () => false,
}))

vi.mock("@/lib/premium-telemetry", () => ({
  createPremiumTelemetryPayload: vi.fn(),
  trackPremiumEvent: vi.fn(),
}))

vi.mock("@/lib/utils", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/utils")>("@/lib/utils")
  return {
    ...actual,
    captureException: vi.fn(),
  }
})

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
  },
}))

describe("ProfilePageClient", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders the auto-remove preference and updates it", async () => {
    const { ProfilePageClient } =
      await import("../app/profile/profile-page-client")
    const user = userEvent.setup()

    render(<ProfilePageClient />)

    expect(
      screen.getByRole("heading", { name: "Test User" }),
    ).toBeInTheDocument()
    expect(
      screen.getByText("test@example.com"),
    ).toBeInTheDocument()

    const autoRemoveToggleLabel = screen
      .getByText("Auto-remove from Should Watch")
      .closest("label")

    expect(autoRemoveToggleLabel).not.toBeNull()

    const autoRemoveToggle = within(autoRemoveToggleLabel as HTMLLabelElement).getByRole(
      "switch",
    )

    await user.click(autoRemoveToggle)

    expect(updatePreferenceMock).toHaveBeenCalledWith(
      "autoRemoveFromShouldWatch",
      false,
    )
  })
})
