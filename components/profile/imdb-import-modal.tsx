"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  type PreparedImdbImport,
  type PreparedImdbImportFile,
} from "@/lib/imdb-import"
import {
  type ImdbImportFileKind,
  type ImdbImportIgnoredMetadataKey,
  type ImdbImportSkipReason,
  type ImdbImportStats,
} from "@/lib/imdb-import-shared"
import { getImdbImportErrorMessage } from "@/lib/imdb-import-error"
import { queryKeys } from "@/lib/react-query/query-keys"
import { captureException } from "@/lib/utils"
import { imdbImportService } from "@/services/imdb-import-service"
import {
  AlertCircleIcon,
  Loading03Icon,
  Tick02Icon,
  Upload03Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useQueryClient } from "@tanstack/react-query"
import { useRef, useState } from "react"
import { toast } from "sonner"

type ImportStatus = "idle" | "ready" | "running" | "failed" | "success"

type SummaryEntry = {
  key: string
  label: string
  value: number
}

const FILE_KIND_LABELS: Record<ImdbImportFileKind, string> = {
  checkins: "Check-ins",
  list: "List",
  ratings: "Ratings",
  watchlist: "Watchlist",
}

const IMPORTED_LABELS = {
  customListsCreated: "Custom lists created",
  listItems: "List items",
  ratings: "Ratings",
  watchedEpisodes: "Watched episodes",
  watchedMovies: "Watched movies",
  watchedShows: "Watched shows",
} as const

const SKIPPED_LABELS: Record<ImdbImportSkipReason, string> = {
  invalid_date: "Invalid dates",
  invalid_rating: "Invalid ratings",
  malformed_row: "Malformed rows",
  unresolved_imdb_id: "Unmatched IMDb IDs",
  unsupported_file: "Unsupported files",
  unsupported_list_episode: "Episodes in lists",
  unsupported_non_title_row: "Unsupported non-title rows",
  unsupported_tmdb_result: "Unsupported matches",
}

const IGNORED_LABELS: Record<ImdbImportIgnoredMetadataKey, string> = {
  item_notes: "Item notes",
}

interface ImdbImportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
}

export function ImdbImportModal({
  open,
  onOpenChange,
  userId,
}: ImdbImportModalProps) {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [preparedImport, setPreparedImport] =
    useState<PreparedImdbImport | null>(null)
  const [status, setStatus] = useState<ImportStatus>("idle")
  const [completedChunks, setCompletedChunks] = useState(0)
  const [totalChunks, setTotalChunks] = useState(0)
  const [runtimeStats, setRuntimeStats] = useState<ImdbImportStats | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isReadingFiles, setIsReadingFiles] = useState(false)

  const isRunning = status === "running"
  const selectedFileCount =
    (preparedImport?.files.length ?? 0) +
    (preparedImport?.unsupportedFiles.length ?? 0)
  const selectedChunkCount = preparedImport?.chunks.length ?? 0
  const hasImportableChunks = selectedChunkCount > 0
  const activeStats = runtimeStats ?? preparedImport?.stats ?? null
  const progressPercent =
    totalChunks > 0
      ? Math.min(100, Math.round((completedChunks / totalChunks) * 100))
      : 0
  const importedEntries = createSummaryEntries(
    activeStats?.imported ?? {},
    IMPORTED_LABELS,
  )
  const skippedEntries = createSummaryEntries(
    activeStats?.skipped ?? {},
    SKIPPED_LABELS,
  )
  const ignoredEntries = createSummaryEntries(
    activeStats?.ignored ?? {},
    IGNORED_LABELS,
  )

  function resetState() {
    setPreparedImport(null)
    setStatus("idle")
    setCompletedChunks(0)
    setTotalChunks(0)
    setRuntimeStats(null)
    setErrorMessage(null)
    setIsReadingFiles(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (isRunning && !nextOpen) {
      return
    }

    if (!nextOpen) {
      resetState()
    }
    onOpenChange(nextOpen)
  }

  async function handleFilesSelected(files: FileList | null) {
    if (!files || files.length === 0 || isReadingFiles || isRunning) {
      return
    }

    setIsReadingFiles(true)
    setErrorMessage(null)
    setRuntimeStats(null)

    try {
      const rawFiles = await imdbImportService.readRawFiles(files)
      const prepared = imdbImportService.prepareFiles(rawFiles)
      setPreparedImport(prepared)
      setCompletedChunks(0)
      setTotalChunks(prepared.chunks.length)
      setStatus(prepared.chunks.length > 0 ? "ready" : "idle")
    } catch (error) {
      captureException(error)
      setErrorMessage("The selected files could not be read.")
      setStatus("failed")
    } finally {
      setIsReadingFiles(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  async function handleStartImport() {
    if (!preparedImport || !hasImportableChunks || isRunning) {
      return
    }

    setStatus("running")
    setErrorMessage(null)
    setCompletedChunks(0)
    setTotalChunks(preparedImport.chunks.length)
    setRuntimeStats(preparedImport.stats)

    try {
      const stats = await imdbImportService.runPreparedImport(
        preparedImport,
        (progress) => {
          setCompletedChunks(progress.completedChunks)
          setTotalChunks(progress.totalChunks)
          setRuntimeStats(progress.stats)
        },
      )

      setRuntimeStats(stats)
      setStatus("success")
      toast.success("IMDb import complete")

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.firestore.lists(userId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.firestore.ratings(userId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.firestore.episodeTrackingAll(userId),
        }),
        queryClient.invalidateQueries({
          queryKey: ["firestore", "watched-movies", userId],
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.firestore.collectionTrackingRoot,
        }),
      ])
    } catch (error) {
      captureException(error)
      setErrorMessage(getImdbImportErrorMessage(error))
      setStatus("failed")
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[min(760px,calc(100svh-2rem))] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import from IMDb</DialogTitle>
          <DialogDescription>
            Bring over IMDb ratings, watchlist items, custom lists, and
            check-ins from exported CSV files.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <input
            ref={fileInputRef}
            type="file"
            aria-label="IMDb CSV files"
            accept=".csv,text/csv,text/plain"
            multiple
            className="hidden"
            onChange={(event) => void handleFilesSelected(event.target.files)}
          />

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              className="bg-[#F5C518] text-black hover:bg-[#f5c518]/85"
              disabled={isReadingFiles || isRunning}
              onClick={() => fileInputRef.current?.click()}
              type="button"
            >
              {isReadingFiles ? (
                <HugeiconsIcon
                  icon={Loading03Icon}
                  className="size-4 animate-spin"
                />
              ) : (
                <HugeiconsIcon icon={Upload03Icon} className="size-4" />
              )}
              {preparedImport ? "Replace files" : "Select CSV files"}
            </Button>
            <Button
              disabled={!hasImportableChunks || isReadingFiles || isRunning}
              onClick={() => void handleStartImport()}
              type="button"
            >
              {isRunning ? (
                <HugeiconsIcon
                  icon={Loading03Icon}
                  className="size-4 animate-spin"
                />
              ) : null}
              {isRunning ? "Importing..." : "Start import"}
            </Button>
          </div>

          {preparedImport ? (
            <div className="grid gap-2 sm:grid-cols-3">
              <Metric
                label="Files"
                value={selectedFileCount.toLocaleString()}
              />
              <Metric
                label="Supported rows"
                value={preparedImport.stats.processedActions.toLocaleString()}
              />
              <Metric
                label="Batches"
                value={selectedChunkCount.toLocaleString()}
              />
            </div>
          ) : null}

          {status === "running" || status === "failed" ? (
            <div className="space-y-2 rounded-lg bg-white/5 p-4">
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="font-medium text-white">
                  {status === "failed"
                    ? "Import paused"
                    : `${progressPercent}%`}
                </span>
                <span className="text-white/50">
                  {completedChunks} of {totalChunks} batches
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-[#F5C518] transition-[width]"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              {errorMessage ? (
                <div className="flex items-start gap-2 text-sm text-amber-200">
                  <HugeiconsIcon
                    icon={AlertCircleIcon}
                    className="mt-0.5 size-4"
                  />
                  <span>{errorMessage}</span>
                </div>
              ) : null}
              {status === "failed" ? (
                <Button
                  className="mt-2"
                  disabled={!hasImportableChunks}
                  onClick={() => void handleStartImport()}
                  type="button"
                >
                  Retry import
                </Button>
              ) : null}
            </div>
          ) : null}

          {status === "success" ? (
            <div className="space-y-3 rounded-lg bg-green-500/10 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-green-300">
                <HugeiconsIcon icon={Tick02Icon} className="size-4" />
                Import complete
              </div>
              <ResultGroup title="Imported" entries={importedEntries} />
              <ResultGroup title="Skipped" entries={skippedEntries} />
              <ResultGroup title="Ignored" entries={ignoredEntries} />
            </div>
          ) : null}

          {preparedImport ? (
            <div className="space-y-3">
              {preparedImport.files.length > 0 ? (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold tracking-wide text-white/40 uppercase">
                    Recognized files
                  </h3>
                  <div className="divide-y divide-white/10 rounded-lg bg-white/5">
                    {preparedImport.files.map((file) => (
                      <FileRow key={file.fileName} file={file} />
                    ))}
                  </div>
                </div>
              ) : null}

              {preparedImport.unsupportedFiles.length > 0 ? (
                <div className="rounded-lg bg-amber-500/10 p-4">
                  <h3 className="mb-2 text-sm font-medium text-amber-200">
                    Unsupported files
                  </h3>
                  <ul className="space-y-1 text-sm text-white/60">
                    {preparedImport.unsupportedFiles.map((fileName) => (
                      <li key={fileName}>{fileName}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}

          {!preparedImport ? (
            <div className="rounded-lg bg-white/5 p-4 text-sm text-white/60">
              Your selected files will appear here.
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/5 px-4 py-3">
      <div className="text-xs font-medium text-white/40 uppercase">{label}</div>
      <div className="mt-1 text-sm font-semibold text-white">{value}</div>
    </div>
  )
}

function FileRow({ file }: { file: PreparedImdbImportFile }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-white">
          {file.fileName}
        </div>
        <div className="mt-0.5 text-xs text-white/50">
          {file.totalRows.toLocaleString()} rows
        </div>
      </div>
      <span className="shrink-0 rounded-full bg-[#F5C518] px-2 py-0.5 text-xs font-bold text-black">
        {FILE_KIND_LABELS[file.kind]}
      </span>
    </div>
  )
}

function ResultGroup({
  entries,
  title,
}: {
  entries: SummaryEntry[]
  title: string
}) {
  if (entries.length === 0) {
    return null
  }

  return (
    <div className="rounded-lg bg-black/15 p-3">
      <h3 className="mb-2 text-xs font-semibold tracking-wide text-white/40 uppercase">
        {title}
      </h3>
      <div className="space-y-1">
        {entries.map((entry) => (
          <div
            key={entry.key}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <span className="text-white/60">{entry.label}</span>
            <span className="font-semibold text-white">
              {entry.value.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function createSummaryEntries(
  stats: object,
  labelMap: Record<string, string>,
): SummaryEntry[] {
  return Object.entries(stats as Record<string, number>)
    .filter(([, value]) => (value ?? 0) > 0)
    .map(([key, value]) => ({
      key,
      label: labelMap[key] ?? key,
      value: value ?? 0,
    }))
    .sort((left, right) => right.value - left.value)
}
