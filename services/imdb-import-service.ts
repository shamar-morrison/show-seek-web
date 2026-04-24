"use client"

import {
  createEmptyImdbImportStats,
  mergeImdbImportStats,
  type ImdbImportChunkRequest,
  type ImdbImportChunkResult,
  type ImdbImportStats,
} from "@/lib/imdb-import-shared"
import {
  prepareImdbImport,
  type PreparedImdbImport,
  type RawImdbImportFile,
} from "@/lib/imdb-import"
import { getFirebaseFunctions } from "@/lib/firebase/config"
import { httpsCallable } from "firebase/functions"

export interface ImdbImportProgress {
  completedChunks: number
  stats: ImdbImportStats
  totalChunks: number
}

class ImdbImportService {
  async readRawFiles(files: FileList | File[]): Promise<RawImdbImportFile[]> {
    return Promise.all(
      Array.from(files).map(async (file) => ({
        content: await file.text(),
        fileName: file.name || "imdb-import.csv",
      })),
    )
  }

  prepareFiles(files: RawImdbImportFile[]): PreparedImdbImport {
    return prepareImdbImport(files)
  }

  async runPreparedImport(
    preparedImport: PreparedImdbImport,
    onProgress?: (progress: ImdbImportProgress) => void,
  ): Promise<ImdbImportStats> {
    let runtimeStats = createEmptyImdbImportStats()
    const totalChunks = preparedImport.chunks.length
    const importCallable = httpsCallable<
      ImdbImportChunkRequest,
      ImdbImportChunkResult
    >(getFirebaseFunctions(), "importImdbChunk")

    onProgress?.({
      completedChunks: 0,
      stats: combineImportStats(preparedImport.stats, runtimeStats),
      totalChunks,
    })

    for (let index = 0; index < preparedImport.chunks.length; index += 1) {
      const chunk = preparedImport.chunks[index]
      try {
        const result = await importCallable(chunk)
        runtimeStats = mergeImdbImportStats(runtimeStats, result.data)
      } catch (error) {
        onProgress?.({
          completedChunks: index,
          stats: combineImportStats(preparedImport.stats, runtimeStats),
          totalChunks,
        })
        throw error
      }

      onProgress?.({
        completedChunks: index + 1,
        stats: combineImportStats(preparedImport.stats, runtimeStats),
        totalChunks,
      })
    }

    return combineImportStats(preparedImport.stats, runtimeStats)
  }
}

export const imdbImportService = new ImdbImportService()

function combineImportStats(
  preparedStats: ImdbImportStats,
  runtimeStats: ImdbImportStats,
): ImdbImportStats {
  const merged = mergeImdbImportStats(preparedStats, runtimeStats)

  return {
    ...merged,
    processedActions: preparedStats.processedActions,
    processedEntities: preparedStats.processedEntities,
  }
}
