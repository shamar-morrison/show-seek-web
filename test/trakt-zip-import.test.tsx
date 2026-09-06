import { TraktZipImportModal } from "@/components/profile/trakt-zip-import-modal"
import { fireEvent, render, screen } from "@/test/utils"
import type { TraktZipImportProgressDoc, TraktZipImportUIState } from "@/types/trakt"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  dismissZipImport: vi.fn(),
  startZipImport: vi.fn(),
  push: vi.fn(),
  traktContextValue: {
    isSyncing: false,
    isEnriching: false,
    isZipImporting: false,
    isZipImportRateLimited: false,
    nextAllowedZipImportAt: null as Date | null,
    zipImportUiState: "idle" as TraktZipImportUIState,
    zipUploadProgress: 0,
    zipImportDoc: null as TraktZipImportProgressDoc | null,
    zipImportError: null as string | null,
    selectedZipFile: null,
    startZipImport: vi.fn(),
    dismissZipImport: vi.fn(),
    setSelectedZipFile: vi.fn(),
  },
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mocks.push,
  }),
}))

vi.mock("@/context/trakt-context", () => ({
  useTrakt: () => mocks.traktContextValue,
}))

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: { children: ReactNode; open: boolean }) =>
    open ? <>{children}</> : null,
  DialogContent: ({ children }: { children: ReactNode }) => (
    <div role="dialog">{children}</div>
  ),
  DialogDescription: ({ children }: { children: ReactNode }) => (
    <p>{children}</p>
  ),
  DialogHeader: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}))

vi.mock("@hugeicons/core-free-icons", () => ({
  Alert02Icon: {},
  ArrowDown01Icon: {},
  ArrowRight01Icon: {},
  ArrowUp01Icon: {},
  Cancel01Icon: {},
  CheckmarkCircle02Icon: {},
  FavouriteIcon: {},
  FileZipIcon: {},
  Film01Icon: {},
  FolderAddIcon: {},
  Folder01Icon: {},
  Loading03Icon: {},
  RefreshIcon: {},
  StarIcon: {},
  Tick02Icon: {},
  Tv01Icon: {},
  Upload03Icon: {},
}))

vi.mock("@hugeicons/react", () => ({
  HugeiconsIcon: () => <span aria-hidden="true" />,
}))

describe("TraktZipImportModal", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.traktContextValue = {
      isSyncing: false,
      isEnriching: false,
      isZipImporting: false,
      isZipImportRateLimited: false,
      nextAllowedZipImportAt: null,
      zipImportUiState: "idle",
      zipUploadProgress: 0,
      zipImportDoc: null,
      zipImportError: null,
      selectedZipFile: null,
      startZipImport: mocks.startZipImport,
      dismissZipImport: mocks.dismissZipImport,
      setSelectedZipFile: vi.fn(),
    }
  })

  it("renders idle view with file selector and what will be imported guide", () => {
    render(<TraktZipImportModal open={true} onOpenChange={() => {}} />)

    expect(screen.getByText("Import Trakt Export Archive")).toBeInTheDocument()
    expect(
      screen.getByText("Select Trakt export zip file"),
    ).toBeInTheDocument()
    expect(screen.getByText("What will be imported")).toBeInTheDocument()
    expect(screen.getByText("Watched Movies:")).toBeInTheDocument()
    expect(
      screen.getByText("Granular Watch History:"),
    ).toBeInTheDocument()
    expect(screen.getByText("Episode Progress:")).toBeInTheDocument()
    expect(screen.getByText("Ratings:")).toBeInTheDocument()
    expect(screen.getByText("Watchlist & Favorites:")).toBeInTheDocument()
    expect(screen.getByText("Custom Lists:")).toBeInTheDocument()
  })

  it("renders cooldown banner when import is rate limited", () => {
    const futureDate = new Date(Date.now() + 60 * 60 * 1000)
    mocks.traktContextValue.isZipImportRateLimited = true
    mocks.traktContextValue.nextAllowedZipImportAt = futureDate

    render(<TraktZipImportModal open={true} onOpenChange={() => {}} />)

    expect(screen.getByText("Import Cooldown Active")).toBeInTheDocument()
    expect(screen.getByText(/You can start another import/i)).toBeInTheDocument()
  })

  it("renders sync running banner when OAuth sync is active", () => {
    mocks.traktContextValue.isSyncing = true

    render(<TraktZipImportModal open={true} onOpenChange={() => {}} />)

    expect(screen.getByText("Trakt Sync In Progress")).toBeInTheDocument()
  })

  it("allows selecting a .zip file and starting import", async () => {
    render(<TraktZipImportModal open={true} onOpenChange={() => {}} />)

    const file = new File(["dummy content"], "trakt-export.zip", {
      type: "application/zip",
    })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    expect(input).toBeInTheDocument()

    fireEvent.change(input, { target: { files: [file] } })

    expect(screen.getByText("trakt-export.zip")).toBeInTheDocument()

    const startButton = screen.getByRole("button", { name: /Start import/i })
    expect(startButton).not.toBeDisabled()

    fireEvent.click(startButton)
    expect(mocks.startZipImport).toHaveBeenCalledWith(file)
  })

  it("renders uploading view with progress percentage", () => {
    mocks.traktContextValue.zipImportUiState = "uploading"
    mocks.traktContextValue.zipUploadProgress = 0.65

    render(<TraktZipImportModal open={true} onOpenChange={() => {}} />)

    expect(screen.getByText("Uploading Archive")).toBeInTheDocument()
    expect(screen.getByText("65%")).toBeInTheDocument()
  })

  it("renders processing view with phase text", () => {
    mocks.traktContextValue.zipImportUiState = "processing"
    mocks.traktContextValue.zipImportDoc = {
      id: "zip_123",
      userId: "user-1",
      status: "processing",
      progress: {
        current: 120,
        total: 500,
        phase: "syncing",
      },
      stats: {
        customLists: 0,
        episodes: 0,
        favorites: 0,
        movies: 0,
        movieWatches: 0,
        ratings: 0,
        shows: 0,
        watchlist: 0,
      },
    }

    render(<TraktZipImportModal open={true} onOpenChange={() => {}} />)

    expect(screen.getByText("Processing Import")).toBeInTheDocument()
    expect(screen.getByText("Syncing to ShowSeek...")).toBeInTheDocument()
    expect(screen.getByText("120 of 500 items processed")).toBeInTheDocument()
  })

  it("renders completed view with 8 stats and action buttons", () => {
    mocks.traktContextValue.zipImportUiState = "completed"
    mocks.traktContextValue.zipImportDoc = {
      id: "zip_123",
      userId: "user-1",
      status: "completed",
      progress: { current: 500, total: 500, phase: "completed" },
      stats: {
        movies: 150,
        shows: 25,
        episodes: 450,
        ratings: 120,
        watchlist: 40,
        favorites: 15,
        customLists: 3,
        movieWatches: 180,
      },
    }

    render(<TraktZipImportModal open={true} onOpenChange={() => {}} />)

    expect(screen.getByText("Import Complete")).toBeInTheDocument()
    expect(screen.getByText("150")).toBeInTheDocument() // Movies
    expect(screen.getByText("25")).toBeInTheDocument() // Shows
    expect(screen.getByText("450")).toBeInTheDocument() // Episodes
    expect(screen.getByText("120")).toBeInTheDocument() // Ratings
    expect(screen.getByText("40")).toBeInTheDocument() // Watchlist
    expect(screen.getByText("15")).toBeInTheDocument() // Favorites
    expect(screen.getByText("3")).toBeInTheDocument() // Custom Lists
    expect(screen.getByText("180")).toBeInTheDocument() // Movie Watches

    const viewLibraryBtn = screen.getByRole("button", { name: "View Library" })
    fireEvent.click(viewLibraryBtn)
    expect(mocks.dismissZipImport).toHaveBeenCalled()
    expect(mocks.push).toHaveBeenCalledWith("/lists")
  })

  it("renders failed view with error message and retry button", () => {
    mocks.traktContextValue.zipImportUiState = "failed"
    mocks.traktContextValue.zipImportError = "Rate limit reached. Please wait."

    render(<TraktZipImportModal open={true} onOpenChange={() => {}} />)

    expect(screen.getByText("Import Failed")).toBeInTheDocument()
    expect(
      screen.getByText("Rate limit reached. Please wait."),
    ).toBeInTheDocument()

    const tryAgainBtn = screen.getByRole("button", { name: "Try Again" })
    fireEvent.click(tryAgainBtn)
    expect(mocks.dismissZipImport).toHaveBeenCalled()
  })
})
