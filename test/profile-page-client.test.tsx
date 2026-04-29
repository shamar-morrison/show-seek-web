import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor, within } from "./utils"

const updatePreferenceMock = vi.fn()
const updateRegionMock = vi.fn()
const pushMock = vi.fn()
const signOutMock = vi.fn()
const useTraktMock = vi.fn()
const toastErrorMock = vi.fn()
let mockSearchParams = new URLSearchParams()

vi.mock("@/components/premium-modal", () => ({
  PremiumModal: () => null,
}))

vi.mock("@/components/profile/action-button", () => ({
  ActionButton: ({
    badge,
    badgeClassName: _badgeClassName,
    disabled,
    label,
    onClick,
  }: {
    badge?: string
    badgeClassName?: string
    disabled?: boolean
    label: string
    onClick?: () => void
  }) => (
    <button disabled={disabled} onClick={onClick} type="button">
      {label}
      {badge ? <span>{badge}</span> : null}
    </button>
  ),
}))

vi.mock("@/components/profile/export-data-modal", () => ({
  ExportDataModal: ({ open }: { open: boolean }) =>
    open ? <div role="dialog">Export data</div> : null,
}))

vi.mock("@/components/profile/HomeScreenCustomizer", () => ({
  HomeScreenCustomizer: ({ open }: { open: boolean }) =>
    open ? <div role="dialog">Home screen customizer</div> : null,
}))

vi.mock("@/components/profile/imdb-import-modal", () => ({
  ImdbImportModal: ({ open }: { open: boolean }) =>
    open ? <div role="dialog">IMDb import</div> : null,
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
  Cancel01Icon: {},
  CrownIcon: {},
  FileExportIcon: {},
  FileImportIcon: {},
  Home01Icon: {},
  Location01Icon: {},
  Loading03Icon: {},
  Logout01Icon: {},
  Tick02Icon: {},
}))

vi.mock("@hugeicons/react", () => ({
  HugeiconsIcon: () => <span aria-hidden="true" />,
}))

vi.mock("next/navigation", () => ({
  usePathname: () => "/profile",
  useRouter: () => ({
    push: pushMock,
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
      region: "US" as const,
      isLoading: false,
      updatePreference: updatePreferenceMock,
      updateRegion: updateRegionMock,
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
    error: toastErrorMock,
    info: vi.fn(),
  },
}))

describe("ProfilePageClient", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchParams = new URLSearchParams()
    updateRegionMock.mockResolvedValue(undefined)
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

  it("defaults to the preferences tab when no tab param is present", async () => {
    const { ProfilePageClient } =
      await import("../app/profile/profile-page-client")

    render(<ProfilePageClient />)

    expect(screen.getByRole("tab", { name: "Preferences" })).toHaveAttribute(
      "aria-selected",
      "true",
    )
    expect(
      screen.getByText("Auto-remove from Should Watch"),
    ).toBeInTheDocument()
    expect(screen.queryByText("Customize Home Screen")).not.toBeInTheDocument()
  })

  it("opens the requested tab from a valid tab param", async () => {
    mockSearchParams = new URLSearchParams("tab=content")
    const { ProfilePageClient } =
      await import("../app/profile/profile-page-client")

    render(<ProfilePageClient />)

    expect(screen.getByRole("tab", { name: "Content" })).toHaveAttribute(
      "aria-selected",
      "true",
    )
    expect(screen.getByText("🇺🇸 US")).toBeInTheDocument()
    expect(screen.getByText("Region")).toBeInTheDocument()
    expect(screen.getByText("Customize Home Screen")).toBeInTheDocument()
    expect(
      screen.queryByText("Auto-remove from Should Watch"),
    ).not.toBeInTheDocument()
  })

  it("falls back to preferences for an invalid tab param", async () => {
    mockSearchParams = new URLSearchParams("tab=unknown")
    const { ProfilePageClient } =
      await import("../app/profile/profile-page-client")

    render(<ProfilePageClient />)

    expect(screen.getByRole("tab", { name: "Preferences" })).toHaveAttribute(
      "aria-selected",
      "true",
    )
    expect(
      screen.getByText("Auto-remove from Should Watch"),
    ).toBeInTheDocument()
    expect(screen.queryByText("Trakt Integration")).not.toBeInTheDocument()
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

  it("renders the default bulk action preference and updates it", async () => {
    const { ProfilePageClient } =
      await import("../app/profile/profile-page-client")
    const user = userEvent.setup()

    render(<ProfilePageClient />)

    const bulkActionToggleLabel = screen
      .getByText("Default bulk action: Move")
      .closest("label")

    expect(bulkActionToggleLabel).not.toBeNull()

    const bulkActionToggle = within(
      bulkActionToggleLabel as HTMLLabelElement,
    ).getByRole("switch")

    await user.click(bulkActionToggle)

    expect(updatePreferenceMock).toHaveBeenCalledWith(
      "copyInsteadOfMove",
      true,
    )
  })

  it("updates the url when switching tabs", async () => {
    const { ProfilePageClient } =
      await import("../app/profile/profile-page-client")
    const user = userEvent.setup()

    render(<ProfilePageClient />)

    await user.click(screen.getByRole("tab", { name: "Settings" }))

    expect(pushMock).toHaveBeenCalledWith("/profile?tab=settings", {
      scroll: false,
    })
  })

  it("opens the region modal and updates the selected region", async () => {
    mockSearchParams = new URLSearchParams("tab=content")
    const { ProfilePageClient } =
      await import("../app/profile/profile-page-client")
    const user = userEvent.setup()

    render(<ProfilePageClient />)

    await user.click(screen.getByText("Region"))

    expect(screen.getByRole("dialog")).toHaveTextContent("Region")
    expect(screen.getByRole("button", { name: /Canada/ })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /Canada/ }))

    expect(updateRegionMock).toHaveBeenCalledWith("CA")
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })
  })

  it("keeps the region modal open and shows an error toast when the update fails", async () => {
    mockSearchParams = new URLSearchParams("tab=content")
    updateRegionMock.mockRejectedValueOnce(new Error("boom"))
    const { ProfilePageClient } =
      await import("../app/profile/profile-page-client")
    const user = userEvent.setup()

    render(<ProfilePageClient />)

    await user.click(screen.getByText("Region"))
    await user.click(screen.getByRole("button", { name: /Canada/ }))

    expect(updateRegionMock).toHaveBeenCalledWith("CA")
    expect(screen.getByRole("dialog")).toHaveTextContent("Region")
    expect(toastErrorMock).toHaveBeenCalledWith(
      "Failed to update region. Please try again.",
    )
  })

  it("renders Trakt integration status and opens its settings", async () => {
    mockSearchParams = new URLSearchParams("tab=integrations")
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

  it("opens the IMDb import modal", async () => {
    mockSearchParams = new URLSearchParams("tab=integrations")
    const { ProfilePageClient } =
      await import("../app/profile/profile-page-client")
    const user = userEvent.setup()

    const { container } = render(<ProfilePageClient />)

    expect(
      screen.getByText(
        "Import ratings, watchlists, lists, and check-ins from CSV exports",
      ),
    ).toBeInTheDocument()
    expect(container.querySelector('img[src="/imdb-logo.png"]')).not.toBeNull()

    await user.click(screen.getByText("IMDb Import"))

    expect(screen.getByRole("dialog")).toHaveTextContent("IMDb import")
  })

  it("opens export data and signs out from the settings tab", async () => {
    mockSearchParams = new URLSearchParams("tab=settings")
    signOutMock.mockResolvedValue(undefined)
    const { ProfilePageClient } =
      await import("../app/profile/profile-page-client")
    const user = userEvent.setup()

    render(<ProfilePageClient />)

    await user.click(screen.getByText("Export Data"))
    expect(screen.getByRole("dialog")).toHaveTextContent("Export data")

    await user.click(screen.getByText("Sign Out"))
    expect(signOutMock).toHaveBeenCalledTimes(1)
  })
})
