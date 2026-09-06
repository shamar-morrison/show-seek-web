"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useTrakt } from "@/context/trakt-context"
import { cn } from "@/lib/utils"
import type { TraktZipImportStats } from "@/types/trakt"
import {
  Alert02Icon,
  ArrowDown01Icon,
  ArrowRight01Icon,
  ArrowUp01Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  FavouriteIcon,
  FileZipIcon,
  Film01Icon,
  FolderAddIcon,
  Folder01Icon,
  Loading03Icon,
  RefreshIcon,
  StarIcon,
  Tick02Icon,
  Tv01Icon,
  Upload03Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { formatDistanceToNow } from "date-fns"
import { useRouter } from "next/navigation"
import { useRef, useState } from "react"
import { toast } from "sonner"

interface TraktZipImportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return ""
  const kb = bytes / 1024
  if (kb < 1024) {
    return `${Math.round(kb)} KB`
  }
  const mb = kb / 1024
  return `${mb.toFixed(1)} MB`
}

function getPhaseText(phase?: string): string {
  switch (phase) {
    case "downloading":
      return "Downloading archive..."
    case "parsing":
      return "Parsing Trakt data..."
    case "syncing":
      return "Syncing to ShowSeek..."
    case "pending":
    default:
      return "Preparing import..."
  }
}

function normalizeStat(val: unknown): number {
  if (typeof val === "number" && Number.isFinite(val)) {
    return val
  }
  if (typeof val === "string") {
    const parsed = Number(val)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function StatTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: number
}) {
  const displayValue = Number.isFinite(value) ? value.toLocaleString() : "0"

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-lg font-semibold text-white">
          {displayValue}
        </span>
      </div>
      <div className="mt-1 text-xs text-white/50">{label}</div>
    </div>
  )
}

const IMPORT_FEATURES = [
  {
    title: "Watched Movies",
    description:
      "Added to your Already Watched list with play counts and original watch dates.",
  },
  {
    title: "Granular Watch History",
    description:
      "Multiple watch dates and timestamps for re-watched movies and episodes are fully preserved.",
  },
  {
    title: "Episode Progress",
    description:
      "TV show progress and individual watched episodes imported into tracking.",
  },
  {
    title: "Ratings",
    description:
      "Movie and TV ratings (1–10) mapped and saved to your ShowSeek account.",
  },
  {
    title: "Watchlist & Favorites",
    description:
      "Items in your Trakt watchlist and liked/favorited items imported.",
  },
  {
    title: "Custom Lists",
    description:
      "Custom personal lists created on Trakt recreated with their items.",
  },
]

export function TraktZipImportModal({
  open,
  onOpenChange,
}: TraktZipImportModalProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isGuideOpen, setIsGuideOpen] = useState(true)

  const {
    isSyncing,
    isEnriching,
    isZipImporting,
    isZipImportRateLimited,
    nextAllowedZipImportAt,
    zipImportUiState,
    zipUploadProgress,
    zipImportDoc,
    zipImportError,
    startZipImport,
    dismissZipImport,
  } = useTrakt()

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      if (zipImportUiState === "completed" || zipImportUiState === "failed") {
        dismissZipImport()
      }
      setSelectedFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
    onOpenChange(nextOpen)
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.name.toLowerCase().endsWith(".zip")) {
      toast.error("Please select a valid Trakt export .zip file.")
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
      return
    }

    setSelectedFile(file)
  }

  const handleRemoveFile = () => {
    setSelectedFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleStartImport = async () => {
    if (!selectedFile || isSyncing || isZipImportRateLimited) return

    try {
      await startZipImport(selectedFile)
    } catch (error) {
      console.error("[TraktZipImportModal] Start import error:", error)
    }
  }

  const handleViewLibrary = () => {
    dismissZipImport()
    handleOpenChange(false)
    router.push("/lists")
  }

  const handleDone = () => {
    dismissZipImport()
    handleOpenChange(false)
  }

  const handleTryAgain = () => {
    dismissZipImport()
    setSelectedFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  // --- Render Views ---

  const renderIdleView = () => (
    <div className="space-y-5">
      {/* Hero Section */}
      <div className="flex flex-col items-center text-center">
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-xl bg-white shadow-md">
            <img
              src="/trakt-logo.svg"
              alt=""
              aria-hidden="true"
              className="size-7"
            />
          </div>
          <HugeiconsIcon
            icon={ArrowRight01Icon}
            className="size-5 text-white/40"
          />
          <div className="flex size-12 items-center justify-center rounded-xl border border-white/10 bg-white/5">
            <HugeiconsIcon icon={FileZipIcon} className="size-6 text-[#ed1c24]" />
          </div>
        </div>
        <h3 className="mt-3 text-base font-semibold text-white">
          Import Trakt Export Archive
        </h3>
        <p className="mt-1 text-sm text-white/60">
          Upload your Trakt data export zip file to import your complete
          history, ratings, lists, and watch progress.
        </p>
      </div>

      {/* Sync Running Banner */}
      {isSyncing && (
        <div className="rounded-lg border border-[#ed1c24]/30 bg-[#ed1c24]/10 p-4">
          <div className="flex gap-3">
            <HugeiconsIcon
              icon={RefreshIcon}
              className="mt-0.5 size-5 shrink-0 text-[#ed1c24]"
            />
            <div>
              <h4 className="text-sm font-medium text-white">
                Trakt Sync In Progress
              </h4>
              <p className="mt-1 text-xs text-white/70">
                A Trakt sync is currently running. Please wait for it to
                complete before starting a zip import.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Rate Limited / Cooldown Banner */}
      {isZipImportRateLimited && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
          <div className="flex gap-3">
            <HugeiconsIcon
              icon={Alert02Icon}
              className="mt-0.5 size-5 shrink-0 text-amber-300"
            />
            <div>
              <h4 className="text-sm font-medium text-amber-200">
                Import Cooldown Active
              </h4>
              <p className="mt-1 text-xs text-amber-100/80">
                {nextAllowedZipImportAt &&
                // eslint-disable-next-line react-hooks/purity -- intentional render-time read (mobile parity); parent re-renders on the cooldown tick
                nextAllowedZipImportAt.getTime() > Date.now()
                  ? `You can start another import ${formatDistanceToNow(nextAllowedZipImportAt, { addSuffix: true })}.`
                  : "Please wait before starting another import."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* File Selection Box */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".zip,application/zip"
        className="hidden"
        onChange={handleFileChange}
      />

      {selectedFile ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 p-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#ed1c24]/15">
              <HugeiconsIcon
                icon={FileZipIcon}
                className="size-5 text-[#ed1c24]"
              />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">
                {selectedFile.name}
              </p>
              <p className="text-xs text-white/50">
                {formatFileSize(selectedFile.size) || "Ready to import"}
              </p>
            </div>
          </div>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={handleRemoveFile}
            disabled={isSyncing}
            className="text-white/60 hover:text-white"
          >
            <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
            <span className="sr-only">Remove file</span>
          </Button>
        </div>
      ) : (
        <button
          type="button"
          disabled={isSyncing || isZipImportRateLimited}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-white/20 bg-white/[0.02] p-6 text-center transition-colors",
            isSyncing || isZipImportRateLimited
              ? "cursor-not-allowed opacity-50"
              : "hover:border-white/40 hover:bg-white/[0.04]",
          )}
        >
          <div className="flex size-12 items-center justify-center rounded-full bg-white/5 text-white/70">
            <HugeiconsIcon icon={Upload03Icon} className="size-6" />
          </div>
          <span className="mt-3 text-sm font-medium text-white">
            Select Trakt export zip file
          </span>
          <span className="mt-1 text-xs text-white/50">
            Click to choose your .zip export archive
          </span>
        </button>
      )}

      {/* Start Import Action */}
      <Button
        className="w-full bg-[#ed1c24] text-white hover:bg-[#ed1c24]/85 disabled:bg-white/10 disabled:text-white/40"
        disabled={!selectedFile || isSyncing || isZipImportRateLimited}
        onClick={handleStartImport}
      >
        <HugeiconsIcon icon={Upload03Icon} className="size-4" />
        Start import
      </Button>

      {/* What Will Be Imported Collapsible */}
      <div className="rounded-lg border border-white/10 bg-white/[0.02]">
        <button
          type="button"
          onClick={() => setIsGuideOpen(!isGuideOpen)}
          className="flex w-full items-center justify-between p-3.5 text-left text-xs font-semibold tracking-wider text-white/70 uppercase hover:text-white"
        >
          <span>What will be imported</span>
          <HugeiconsIcon
            icon={isGuideOpen ? ArrowUp01Icon : ArrowDown01Icon}
            className="size-4 text-white/40"
          />
        </button>

        {isGuideOpen && (
          <div className="space-y-2.5 border-t border-white/10 p-3.5 pt-2">
            {IMPORT_FEATURES.map((feature) => (
              <div key={feature.title} className="flex gap-2.5">
                <HugeiconsIcon
                  icon={CheckmarkCircle02Icon}
                  className="mt-0.5 size-4 shrink-0 text-green-400"
                />
                <div className="min-w-0 text-xs">
                  <span className="font-medium text-white">
                    {feature.title}:{" "}
                  </span>
                  <span className="text-white/60">{feature.description}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )

  const renderUploadingView = () => (
    <div className="flex flex-col items-center py-8 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-[#ed1c24]/15">
        <HugeiconsIcon icon={Upload03Icon} className="size-8 text-[#ed1c24]" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-white">
        Uploading Archive
      </h3>
      <p className="mt-1 text-sm text-white/60">
        Uploading your Trakt export archive to secure storage...
      </p>

      <div className="mt-6 w-full max-w-xs space-y-2">
        <div className="h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-[#ed1c24] transition-[width] duration-200"
            style={{ width: `${Math.round(zipUploadProgress * 100)}%` }}
          />
        </div>
        <div className="text-right text-xs font-medium text-white/60">
          {Math.round(zipUploadProgress * 100)}%
        </div>
      </div>
    </div>
  )

  const renderProcessingView = () => (
    <div className="flex flex-col items-center py-8 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-[#ed1c24]/15">
        <HugeiconsIcon
          icon={Loading03Icon}
          className="size-8 animate-spin text-[#ed1c24]"
        />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-white">
        Processing Import
      </h3>
      <p className="mt-1 text-sm text-white/60">
        {getPhaseText(zipImportDoc?.progress?.phase)}
      </p>

      {zipImportDoc?.progress && zipImportDoc.progress.total > 0 && (
        <div className="mt-4 text-xs text-white/50">
          {zipImportDoc.progress.current} of {zipImportDoc.progress.total}{" "}
          items processed
        </div>
      )}

      <div className="mt-6 rounded-lg border border-white/10 bg-white/[0.03] p-4 text-xs text-white/50">
        This may take several minutes for large Trakt exports. You can close this
        dialog; processing will continue in the background.
      </div>
    </div>
  )

  const renderCompletedView = () => {
    const rawStats = zipImportDoc?.stats
    const stats: TraktZipImportStats = {
      customLists: normalizeStat(rawStats?.customLists),
      episodes: normalizeStat(rawStats?.episodes),
      favorites: normalizeStat(rawStats?.favorites),
      movies: normalizeStat(rawStats?.movies),
      movieWatches: normalizeStat(rawStats?.movieWatches),
      ratings: normalizeStat(rawStats?.ratings),
      shows: normalizeStat(rawStats?.shows),
      watchlist: normalizeStat(rawStats?.watchlist),
    }

    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-green-500/20 text-green-400">
            <HugeiconsIcon icon={Tick02Icon} className="size-8" />
          </div>
          <h3 className="mt-3 text-lg font-semibold text-white">
            Import Complete
          </h3>
          <p className="mt-1 text-sm text-white/60">
            Your Trakt data has been successfully imported into ShowSeek.
          </p>

          {isEnriching && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs text-amber-200">
              <HugeiconsIcon
                icon={Loading03Icon}
                className="size-3 animate-spin"
              />
              Fetching movie and show posters in the background...
            </div>
          )}
        </div>

        {/* Stats Grid */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold tracking-wider text-white/40 uppercase">
            Imported Summary
          </h4>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatTile
              icon={
                <HugeiconsIcon
                  icon={Film01Icon}
                  className="size-4 text-white/70"
                />
              }
              label="Movies"
              value={stats.movies}
            />
            <StatTile
              icon={
                <HugeiconsIcon
                  icon={Tv01Icon}
                  className="size-4 text-white/70"
                />
              }
              label="Shows"
              value={stats.shows}
            />
            <StatTile
              icon={
                <HugeiconsIcon
                  icon={CheckmarkCircle02Icon}
                  className="size-4 text-white/70"
                />
              }
              label="Episodes"
              value={stats.episodes}
            />
            <StatTile
              icon={
                <HugeiconsIcon
                  icon={StarIcon}
                  className="size-4 text-amber-400"
                />
              }
              label="Ratings"
              value={stats.ratings}
            />
            <StatTile
              icon={
                <HugeiconsIcon
                  icon={Folder01Icon}
                  className="size-4 text-white/70"
                />
              }
              label="Watchlist"
              value={stats.watchlist}
            />
            <StatTile
              icon={
                <HugeiconsIcon
                  icon={FavouriteIcon}
                  className="size-4 text-red-400"
                />
              }
              label="Favorites"
              value={stats.favorites}
            />
            <StatTile
              icon={
                <HugeiconsIcon
                  icon={FolderAddIcon}
                  className="size-4 text-white/70"
                />
              }
              label="Custom Lists"
              value={stats.customLists}
            />
            <StatTile
              icon={
                <HugeiconsIcon
                  icon={Film01Icon}
                  className="size-4 text-green-400"
                />
              }
              label="Movie Watches"
              value={stats.movieWatches}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button className="sm:flex-1" onClick={handleViewLibrary}>
            View Library
          </Button>
          <Button
            variant="outline"
            className="sm:flex-1"
            onClick={handleDone}
          >
            Done
          </Button>
        </div>
      </div>
    )
  }

  const renderFailedView = () => (
    <div className="flex flex-col items-center py-6 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-red-500/20 text-red-400">
        <HugeiconsIcon icon={Alert02Icon} className="size-8" />
      </div>
      <h3 className="mt-3 text-lg font-semibold text-white">Import Failed</h3>

      <div className="mt-4 w-full rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-left text-sm text-red-200">
        {zipImportError ||
          "An error occurred while importing your Trakt archive. Please try again."}
      </div>

      <div className="mt-6 flex w-full flex-col gap-2 sm:flex-row">
        <Button
          className="bg-[#ed1c24] text-white hover:bg-[#ed1c24]/85 sm:flex-1"
          onClick={handleTryAgain}
        >
          <HugeiconsIcon icon={RefreshIcon} className="size-4" />
          Try Again
        </Button>
        <Button
          variant="outline"
          className="sm:flex-1"
          onClick={handleDone}
        >
          Close
        </Button>
      </div>
    </div>
  )

  const renderContent = () => {
    switch (zipImportUiState) {
      case "uploading":
        return renderUploadingView()
      case "processing":
        return renderProcessingView()
      case "completed":
        return renderCompletedView()
      case "failed":
        return renderFailedView()
      case "idle":
      default:
        return renderIdleView()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[min(760px,calc(100dvh-2rem))] overflow-y-auto border-white/10 bg-[#0b0b0d] p-6 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-white">Trakt Zip Import</DialogTitle>
          <DialogDescription className="text-white/60">
            Import watch history, ratings, and lists from a Trakt export archive.
          </DialogDescription>
        </DialogHeader>

        {renderContent()}
      </DialogContent>
    </Dialog>
  )
}
