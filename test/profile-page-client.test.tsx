import { beforeEach, describe, expect, it, vi } from "vitest"
import userEvent from "@testing-library/user-event"
import { render, screen, within } from "./utils"

const updatePreferenceMock = vi.fn()
const signOutMock = vi.fn()
const useTraktMock = vi.fn()

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

vi.mock("@/components/profile/trakt-settings-modal", () => ({
  TraktSettingsModal: ({ open }: { open: boolean }) =>
    open ? <div role="dialog">Trakt settings</div> : null,
}))

vi.mock("@/components/ui/avatar", () => ({
  Avatar: ({ alt }: { alt: string }) => <div>{alt}</div>,
}))

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: string }) => <span>{children}</span>,
}))

vi.mock("@hugeicons/core-free-icons", () => ({
  ArrowRight01Icon: {},
  CrownIcon: {},
  FileExportIcon: {},
  Home01Icon: {},
  Loading03Icon: {},
  Logout01Icon: {},
  Tick02Icon: {},
}))

vi.mock("@hugeicons/react", () => ({
  HugeiconsIcon: () => <span aria-hidden="true" />,
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

vi.mock("@/context/trakt-context", () => ({
  useTrakt: useTraktMock,
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
    useTraktMock.mockReturnValue({
      isConnected: false,
      isEnriching: false,
      isLoading: false,
      isSyncing: false,
      lastEnrichedAt: null,
      lastSyncedAt: null,
      syncStatus: null,
      checkSyncStatus: vi.fn(),
      connectTrakt: vi.fn(),
      disconnectTrakt: vi.fn(),
      enrichData: vi.fn(),
      syncNow: vi.fn(),
    })
  })

  it("renders the auto-remove preference and updates it", async () => {
    const { ProfilePageClient } =
      await import("../app/profile/profile-page-client")
    const user = userEvent.setup()

    render(<ProfilePageClient />)

    expect(
      screen.getByRole("heading", { name: "Test User" }),
    ).toBeInTheDocument()
    expect(screen.getByText("test@example.com")).toBeInTheDocument()

    const autoRemoveToggleLabel = screen
      .getByText("Auto-remove from Should Watch")
      .closest("label")

    expect(autoRemoveToggleLabel).not.toBeNull()

    const autoRemoveToggle = within(
      autoRemoveToggleLabel as HTMLLabelElement,
    ).getByRole("switch")

    await user.click(autoRemoveToggle)

    expect(updatePreferenceMock).toHaveBeenCalledWith(
      "autoRemoveFromShouldWatch",
      false,
    )
  }, 10000)

  it("renders the original titles preference and updates it", async () => {
    const { ProfilePageClient } =
      await import("../app/profile/profile-page-client")
    const user = userEvent.setup()

    render(<ProfilePageClient />)

    const originalTitlesToggleLabel = screen
      .getByText("Use original titles")
      .closest("label")

    expect(originalTitlesToggleLabel).not.toBeNull()

    const originalTitlesToggle = within(
      originalTitlesToggleLabel as HTMLLabelElement,
    ).getByRole("switch")

    await user.click(originalTitlesToggle)

    expect(updatePreferenceMock).toHaveBeenCalledWith(
      "showOriginalTitles",
      true,
    )
  })

  it("renders Trakt integration status and opens its settings", async () => {
    useTraktMock.mockReturnValue({
      isConnected: true,
      isEnriching: false,
      isLoading: false,
      isSyncing: false,
      lastEnrichedAt: null,
      lastSyncedAt: new Date("2026-04-20T12:00:00.000Z"),
      syncStatus: {
        connected: true,
        status: "completed",
        synced: true,
      },
      checkSyncStatus: vi.fn(),
      connectTrakt: vi.fn(),
      disconnectTrakt: vi.fn(),
      enrichData: vi.fn(),
      syncNow: vi.fn(),
    })

    const { ProfilePageClient } =
      await import("../app/profile/profile-page-client")
    const user = userEvent.setup()

    render(<ProfilePageClient />)

    expect(screen.getByText("Trakt Integration")).toBeInTheDocument()
    expect(screen.getByText("Connected")).toBeInTheDocument()

    await user.click(screen.getByText("Trakt Integration"))

    expect(screen.getByRole("dialog")).toHaveTextContent("Trakt settings")
  })
})
