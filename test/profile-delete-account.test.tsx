import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { isPremiumStatusPending } from "@/lib/premium-gating"
import { render, screen, waitFor } from "./utils"

const signOutMock = vi.fn()
const deleteAccountMock = vi.fn()
const clearLocalAccountDataMock = vi.fn()
const toastErrorMock = vi.fn()
const useTraktMock = vi.fn()
let mockSearchParams = new URLSearchParams()
let mockPremiumStatus = "free"

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

vi.mock("@/components/profile/imdb-import-modal", () => ({
  ImdbImportModal: () => null,
}))

vi.mock("@/components/profile/trakt-settings-modal", () => ({
  TraktSettingsModal: () => null,
}))

vi.mock("@/components/profile/trakt-zip-import-modal", () => ({
  TraktZipImportModal: () => null,
}))

vi.mock("@/components/profile/accent-color-modal", () => ({
  AccentColorModal: () => null,
}))

vi.mock("@/components/profile/region-selector-modal", () => ({
  RegionSelectorModal: () => null,
}))

vi.mock("@/components/ui/avatar", () => ({
  Avatar: ({ alt }: { alt: string }) => <div>{alt}</div>,
}))

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: string }) => <span>{children}</span>,
}))

vi.mock("@hugeicons/core-free-icons", () => ({
  ArrowRight01Icon: {},
  Delete02Icon: {},
  FileExportIcon: {},
  FileZipIcon: {},
  Home01Icon: {},
  Location01Icon: {},
  Loading03Icon: {},
  Logout01Icon: {},
  PaintBoardIcon: {},
  Tick02Icon: {},
}))

vi.mock("@hugeicons/react", () => ({
  HugeiconsIcon: () => <span aria-hidden="true" />,
}))

vi.mock("next/navigation", () => ({
  usePathname: () => "/profile",
  useRouter: () => ({
    push: vi.fn(),
  }),
  useSearchParams: () => mockSearchParams,
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
    premiumStatus: mockPremiumStatus,
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
      region: "US" as const,
      accentColor: "#E50914",
      isLoading: false,
      updatePreference: vi.fn(),
      updateRegion: vi.fn(),
      updateAccentColor: vi.fn(),
    }),
  }
})

vi.mock("@/lib/premium-gating", () => ({
  PREMIUM_LOADING_MESSAGE: "Checking premium status",
  isPremiumStatusPending: vi.fn(() => false),
  shouldEnforcePremiumLock: () => false,
}))

vi.mock("@/lib/premium-telemetry", () => ({
  createPremiumTelemetryPayload: vi.fn(),
  trackPremiumEvent: vi.fn(),
}))

vi.mock("@/lib/firebase/account-deletion", () => ({
  clearLocalAccountData: (...args: unknown[]) =>
    clearLocalAccountDataMock(...args),
  deleteAccount: (...args: unknown[]) => deleteAccountMock(...args),
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
    error: toastErrorMock,
    info: vi.fn(),
    success: vi.fn(),
  },
}))

async function renderSettingsTab() {
  mockSearchParams = new URLSearchParams("tab=settings")
  const { ProfilePageClient } =
    await import("../app/profile/profile-page-client")
  render(<ProfilePageClient />)
  return userEvent.setup()
}

describe("ProfilePageClient delete account", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchParams = new URLSearchParams()
    mockPremiumStatus = "free"
    vi.mocked(isPremiumStatusPending).mockReturnValue(false)
    deleteAccountMock.mockResolvedValue({ success: true })
    signOutMock.mockResolvedValue(undefined)
    window.localStorage.clear()
    useTraktMock.mockReturnValue({
      isConnected: false,
      isLoading: false,
      isSyncing: false,
      isZipImporting: false,
    })
  })

  it("opens the delete dialog from the settings tab", async () => {
    const user = await renderSettingsTab()

    await user.click(screen.getByRole("button", { name: "Delete Account" }))

    expect(
      screen.getByRole("heading", { name: "Delete account?" }),
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText("Type your account email to confirm"),
    ).toBeInTheDocument()
    expect(deleteAccountMock).not.toHaveBeenCalled()
  })

  it("requires the account email before enabling deletion", async () => {
    const user = await renderSettingsTab()

    await user.click(screen.getByRole("button", { name: "Delete Account" }))
    const confirmButton = screen.getByRole("button", {
      name: "Delete my account",
    })
    expect(confirmButton).toBeDisabled()

    await user.type(
      screen.getByLabelText("Type your account email to confirm"),
      "wrong@example.com",
    )
    expect(confirmButton).toBeDisabled()

    await user.clear(
      screen.getByLabelText("Type your account email to confirm"),
    )
    await user.type(
      screen.getByLabelText("Type your account email to confirm"),
      "test@example.com",
    )
    expect(confirmButton).toBeEnabled()
  })

  it("deletes the account, clears local data, and signs out", async () => {
    const user = await renderSettingsTab()

    await user.click(screen.getByRole("button", { name: "Delete Account" }))
    await user.type(
      screen.getByLabelText("Type your account email to confirm"),
      "test@example.com",
    )
    await user.click(screen.getByRole("button", { name: "Delete my account" }))

    await waitFor(() => {
      expect(deleteAccountMock).toHaveBeenCalledTimes(1)
    })
    expect(clearLocalAccountDataMock).toHaveBeenCalledWith("user-1")
    expect(signOutMock).toHaveBeenCalledTimes(1)
    expect(toastErrorMock).not.toHaveBeenCalled()
  })

  it("clears the user-scoped trakt state from localStorage", async () => {
    const { clearLocalAccountData: actualClear } = await vi.importActual<
      typeof import("../lib/firebase/account-deletion")
    >("../lib/firebase/account-deletion")

    window.localStorage.setItem(
      "showseek_trakt_state_v1_user-1",
      JSON.stringify({ connected: true }),
    )
    window.localStorage.setItem("unrelated_key", "keep")

    actualClear("user-1")

    expect(
      window.localStorage.getItem("showseek_trakt_state_v1_user-1"),
    ).toBeNull()
    expect(window.localStorage.getItem("unrelated_key")).toBe("keep")
  })

    it("shows an error and stays signed in when deletion fails", async () => {

    deleteAccountMock.mockRejectedValue(new Error("boom"))
    const user = await renderSettingsTab()

    await user.click(screen.getByRole("button", { name: "Delete Account" }))
    await user.type(
      screen.getByLabelText("Type your account email to confirm"),
      "test@example.com",
    )
    await user.click(screen.getByRole("button", { name: "Delete my account" }))

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith(
        "Failed to delete your account. Please try again.",
      )
    })
    expect(signOutMock).not.toHaveBeenCalled()
  })

  it("blocks premium members until they cancel", async () => {
    mockPremiumStatus = "premium"
    const user = await renderSettingsTab()

    await user.click(screen.getByRole("button", { name: "Delete Account" }))

    expect(
      screen.getByText(/Cancel your Premium subscription first/),
    ).toBeInTheDocument()
    expect(
      screen.queryByLabelText("Type your account email to confirm"),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Delete my account" }),
    ).toBeDisabled()
    expect(deleteAccountMock).not.toHaveBeenCalled()
  })

  it("disables deletion while premium status is unresolved", async () => {
    vi.mocked(isPremiumStatusPending).mockReturnValue(true)
    const user = await renderSettingsTab()

    await user.click(screen.getByRole("button", { name: "Delete Account" }))
    await user.type(
      screen.getByLabelText("Type your account email to confirm"),
      "test@example.com",
    )

    expect(
      screen.getByRole("button", { name: "Delete my account" }),
    ).toBeDisabled()
    expect(deleteAccountMock).not.toHaveBeenCalled()
  })

  it("reports deletion success but failed sign-out without re-enabling", async () => {
    signOutMock.mockRejectedValue(new Error("logout failed"))
    const user = await renderSettingsTab()

    await user.click(screen.getByRole("button", { name: "Delete Account" }))
    await user.type(
      screen.getByLabelText("Type your account email to confirm"),
      "test@example.com",
    )
    await user.click(screen.getByRole("button", { name: "Delete my account" }))

    await waitFor(() => {
      expect(deleteAccountMock).toHaveBeenCalledTimes(1)
    })
    expect(signOutMock).toHaveBeenCalledTimes(1)
    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith(
        "Your account was deleted, but signing out failed. Please reload the page.",
      )
    })
    expect(toastErrorMock).not.toHaveBeenCalledWith(
      "Failed to delete your account. Please try again.",
    )
    const deletingButtons = screen.getAllByRole("button", {
      name: "Deleting...",
    })
    expect(deletingButtons.length).toBeGreaterThan(0)
    for (const button of deletingButtons) {
      expect(button).toBeDisabled()
    }
  })
})
