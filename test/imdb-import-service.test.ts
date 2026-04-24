import type { ImdbImportChunkResult } from "@/lib/imdb-import-shared"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  callable: vi.fn(),
  getFirebaseFunctions: vi.fn(() => ({})),
  httpsCallable: vi.fn(),
}))

vi.mock("@/lib/firebase/config", () => ({
  getFirebaseFunctions: mocks.getFirebaseFunctions,
}))

vi.mock("firebase/functions", () => ({
  httpsCallable: mocks.httpsCallable,
}))

describe("imdbImportService", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.httpsCallable.mockReturnValue(mocks.callable)
    mocks.callable.mockResolvedValue({
      data: {
        ignored: {},
        imported: {
          customListsCreated: 0,
          listItems: 1,
          ratings: 0,
          watchedEpisodes: 0,
          watchedMovies: 0,
          watchedShows: 0,
        },
        processedActions: 0,
        processedEntities: 0,
        skipped: {},
      } satisfies ImdbImportChunkResult,
    })
  })

  it("imports prepared chunks sequentially and reports batch progress", async () => {
    const { imdbImportService } = await import("@/services/imdb-import-service")
    const progress = vi.fn()
    const firstChunk = { entities: [] }
    const secondChunk = { entities: [] }

    const stats = await imdbImportService.runPreparedImport(
      {
        chunks: [firstChunk, secondChunk],
        files: [],
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
      },
      progress,
    )

    expect(mocks.httpsCallable).toHaveBeenCalledWith({}, "importImdbChunk")
    expect(mocks.callable).toHaveBeenNthCalledWith(1, firstChunk)
    expect(mocks.callable).toHaveBeenNthCalledWith(2, secondChunk)
    expect(progress).toHaveBeenCalledWith(
      expect.objectContaining({ completedChunks: 0, totalChunks: 2 }),
    )
    expect(progress).toHaveBeenLastCalledWith(
      expect.objectContaining({ completedChunks: 2, totalChunks: 2 }),
    )
    expect(stats.imported.listItems).toBe(2)
    expect(stats.processedActions).toBe(2)
    expect(stats.processedEntities).toBe(2)
  })
})
