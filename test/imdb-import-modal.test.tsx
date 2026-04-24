import { ImdbImportModal } from "@/components/profile/imdb-import-modal"
import { fireEvent, render, screen, waitFor } from "@/test/utils"
import type { PreparedImdbImport } from "@/lib/imdb-import"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  captureException: vi.fn(),
  invalidateQueries: vi.fn(),
  prepareFiles: vi.fn(),
  readRawFiles: vi.fn(),
  runPreparedImport: vi.fn(),
  toastSuccess: vi.fn(),
}))

const preparedImport: PreparedImdbImport = {
  chunks: [
    {
      entities: [
        {
          actions: [],
          imdbId: "tt0133093",
          rawTitleType: "movie",
          title: "The Matrix",
        },
      ],
    },
  ],
  files: [
    {
      fileName: "ratings.csv",
      kind: "ratings",
      stats: {
        ignored: {},
        imported: {
          customListsCreated: 0,
          listItems: 0,
          ratings: 0,
          watchedEpisodes: 0,
          watchedMovies: 0,
          watchedShows: 0,
        },
        processedActions: 1,
        processedEntities: 1,
        skipped: {},
      },
      totalRows: 1,
    },
    {
      fileName: "watchlist.csv",
      kind: "watchlist",
      stats: {
        ignored: {},
        imported: {
          customListsCreated: 0,
          listItems: 0,
          ratings: 0,
          watchedEpisodes: 0,
          watchedMovies: 0,
          watchedShows: 0,
        },
        processedActions: 1,
        processedEntities: 1,
        skipped: {},
      },
      totalRows: 1,
    },
  ],
  stats: {
    ignored: {},
    imported: {
      customListsCreated: 0,
      listItems: 0,
      ratings: 0,
      watchedEpisodes: 0,
      watchedMovies: 0,
      watchedShows: 0,
    },
    processedActions: 2,
    processedEntities: 2,
    skipped: {},
  },
  unsupportedFiles: [],
}

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
  AlertCircleIcon: {},
  Loading03Icon: {},
  Tick02Icon: {},
  Upload03Icon: {},
}))

vi.mock("@hugeicons/react", () => ({
  HugeiconsIcon: () => <span aria-hidden="true" />,
}))

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: mocks.invalidateQueries,
  }),
}))

vi.mock("@/lib/utils", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/utils")>("@/lib/utils")
  return {
    ...actual,
    captureException: mocks.captureException,
  }
})

vi.mock("@/services/imdb-import-service", () => ({
  imdbImportService: {
    prepareFiles: mocks.prepareFiles,
    readRawFiles: mocks.readRawFiles,
    runPreparedImport: mocks.runPreparedImport,
  },
}))

vi.mock("sonner", () => ({
  toast: {
    success: mocks.toastSuccess,
  },
}))

describe("ImdbImportModal", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.readRawFiles.mockImplementation(async (files: FileList | File[]) =>
      Array.from(files).map((file) => ({
        content: `content for ${file.name}`,
        fileName: file.name,
      })),
    )
    mocks.prepareFiles.mockReturnValue(preparedImport)
    mocks.runPreparedImport.mockResolvedValue({
      ...preparedImport.stats,
      imported: {
        ...preparedImport.stats.imported,
        listItems: 1,
        ratings: 1,
      },
    })
  })

  it("accepts multiple CSV files and prepares them together", async () => {
    render(<ImdbImportModal open onOpenChange={vi.fn()} userId="user-1" />)

    const fileInput = screen.getByLabelText("IMDb CSV files")
    const ratingsFile = new File(["rating"], "ratings.csv", {
      type: "text/csv",
    })
    const watchlistFile = new File(["watchlist"], "watchlist.csv", {
      type: "text/csv",
    })

    expect(fileInput).toHaveAttribute("multiple")

    fireEvent.change(fileInput, {
      target: {
        files: [ratingsFile, watchlistFile],
      },
    })

    await waitFor(() => {
      expect(mocks.prepareFiles).toHaveBeenCalledWith([
        { content: "content for ratings.csv", fileName: "ratings.csv" },
        { content: "content for watchlist.csv", fileName: "watchlist.csv" },
      ])
    })

    expect(screen.getByText("ratings.csv")).toBeInTheDocument()
    expect(screen.getByText("watchlist.csv")).toBeInTheDocument()
    expect(screen.getAllByText("2")).toHaveLength(2)
  })
})
