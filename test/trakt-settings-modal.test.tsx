import { TraktSettingsModal } from "@/components/profile/trakt-settings-modal"
import { render, screen } from "@/test/utils"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  connectTrakt: vi.fn(),
  disconnectTrakt: vi.fn(),
  enrichData: vi.fn(),
  syncNow: vi.fn(),
  checkSyncStatus: vi.fn(),
  toastError: vi.fn(),
  toastInfo: vi.fn(),
  toastSuccess: vi.fn(),
  authState: {
    premiumLoading: false,
    premiumStatus: "premium" as "free" | "premium" | "unknown",
  },
  traktState: {
    isConnected: false,
    isEnriching: false,
    isLoading: false,
    isSyncing: false,
    lastEnrichedAt: null as Date | null,
    lastSyncedAt: null as Date | null,
    syncStatus: null as unknown,
  },
}))

vi.mock("@/context/auth-context", () => ({
  useAuth: () => mocks.authState,
}))

vi.mock("@/context/trakt-context", () => ({
  useTrakt: () => ({
    ...mocks.traktState,
    checkSyncStatus: mocks.checkSyncStatus,
    connectTrakt: mocks.connectTrakt,
    disconnectTrakt: mocks.disconnectTrakt,
    enrichData: mocks.enrichData,
    syncNow: mocks.syncNow,
  }),
}))

vi.mock("@/components/premium-modal", () => ({
  PremiumModal: ({ open }: { open: boolean }) =>
    open ? <div role="dialog">Premium required</div> : null,
}))

vi.mock("@hugeicons/core-free-icons", () => ({
  Alert02Icon: {},
  DatabaseSyncIcon: {},
  Loading03Icon: {},
  MagicWand02Icon: {},
  RefreshIcon: {},
  Tick02Icon: {},
  Unlink02Icon: {},
}))

vi.mock("@hugeicons/react", () => ({
  HugeiconsIcon: () => <span aria-hidden="true" />,
}))

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <>{children}</> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div role="dialog">{children}</div>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p>{children}</p>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
}))

vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({
    children,
    open,
  }: {
    children: React.ReactNode
    open: boolean
  }) => (open ? <>{children}</> : null),
  AlertDialogAction: ({
    children,
    onClick,
  }: {
    children: React.ReactNode
    onClick?: () => void
  }) => (
    <button onClick={onClick} type="button">
      {children}
    </button>
  ),
  AlertDialogCancel: ({ children }: { children: React.ReactNode }) => (
    <button type="button">{children}</button>
  ),
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p>{children}</p>
  ),
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
}))

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => mocks.toastError(...args),
    info: (...args: unknown[]) => mocks.toastInfo(...args),
    success: (...args: unknown[]) => mocks.toastSuccess(...args),
  },
}))

describe("TraktSettingsModal", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.authState.premiumLoading = false
    mocks.authState.premiumStatus = "premium"
    mocks.traktState.isConnected = false
    mocks.traktState.isEnriching = false
    mocks.traktState.isLoading = false
    mocks.traktState.isSyncing = false
    mocks.traktState.lastEnrichedAt = null
    mocks.traktState.lastSyncedAt = null
    mocks.traktState.syncStatus = null
  })

  it("gates connecting behind Premium", async () => {
    mocks.authState.premiumStatus = "free"
    const user = userEvent.setup()

    render(<TraktSettingsModal open onOpenChange={vi.fn()} />)

    await user.click(screen.getByRole("button", { name: /connect trakt/i }))

    expect(screen.getByText("Premium required")).toBeInTheDocument()
    expect(mocks.connectTrakt).not.toHaveBeenCalled()
  })

  it("shows connected status, import counts, and actions", () => {
    mocks.traktState.isConnected = true
    mocks.traktState.lastSyncedAt = new Date("2026-04-20T12:00:00.000Z")
    mocks.traktState.syncStatus = {
      connected: true,
      itemsSynced: {
        episodes: 5,
        favorites: 1,
        lists: 2,
        movies: 3,
        ratings: 4,
        shows: 2,
        watchlistItems: 7,
      },
      status: "completed",
      synced: true,
    }

    render(<TraktSettingsModal open onOpenChange={vi.fn()} />)

    expect(screen.getByText("Imported")).toBeInTheDocument()
    expect(screen.getByText("Movies")).toBeInTheDocument()
    expect(screen.getByText("3")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /mirror now/i })).toBeEnabled()
    expect(screen.getByRole("button", { name: /enrich data/i })).toBeEnabled()
  })

  it("disables enrichment before the first successful import", () => {
    mocks.traktState.isConnected = true
    mocks.traktState.lastSyncedAt = null
    mocks.traktState.syncStatus = {
      connected: true,
      status: "idle",
      synced: false,
    }

    render(<TraktSettingsModal open onOpenChange={vi.fn()} />)

    expect(
      screen.getByRole("button", { name: /import from trakt/i }),
    ).toBeEnabled()
    expect(screen.getByRole("button", { name: /enrich data/i })).toBeDisabled()
  })

  it("shows a no-change state when a completed sync imported nothing", () => {
    mocks.traktState.isConnected = true
    mocks.traktState.syncStatus = {
      connected: true,
      itemsSynced: {
        episodes: 0,
        favorites: 0,
        lists: 0,
        movies: 0,
        ratings: 0,
        shows: 0,
        watchlistItems: 0,
      },
      status: "completed",
      synced: true,
    }

    render(<TraktSettingsModal open onOpenChange={vi.fn()} />)

    expect(
      screen.getByText(
        "No changes were imported in the last completed Trakt sync.",
      ),
    ).toBeInTheDocument()
  })

  it("shows backend error banners", () => {
    mocks.traktState.isConnected = true
    mocks.traktState.syncStatus = {
      connected: true,
      errorCategory: "storage_limit",
      errorMessage: "Your account has too much Trakt data to import safely.",
      status: "failed",
      synced: false,
    }

    render(<TraktSettingsModal open onOpenChange={vi.fn()} />)

    expect(
      screen.getByText("ShowSeek storage limit reached"),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        "Your account has too much Trakt data to import safely.",
      ),
    ).toBeInTheDocument()
  })

  it("shows past retry timestamps as available now", () => {
    mocks.traktState.isConnected = true
    mocks.traktState.syncStatus = {
      connected: true,
      errorCategory: "rate_limited",
      errorMessage: "Try again later.",
      nextAllowedSyncAt: "2000-01-01T00:00:00.000Z",
      status: "failed",
      synced: true,
    }

    render(<TraktSettingsModal open onOpenChange={vi.fn()} />)

    expect(
      screen.getByText("Next import is available now."),
    ).toBeInTheDocument()
  })
})
