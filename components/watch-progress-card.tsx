"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  formatRemainingTime,
  type WatchProgressItem,
} from "@/hooks/use-episode-tracking"
import { buildImageUrl } from "@/lib/tmdb"
import { episodeTrackingService } from "@/services/episode-tracking-service"
import { Delete02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import Link from "next/link"
import { useState } from "react"

interface WatchProgressCardProps {
  /** Watch progress data */
  progress: WatchProgressItem
}

/**
 * WatchProgressCard Component
 * Displays TV show watch progress with poster, title, progress bar, and next episode
 */
export function WatchProgressCard({ progress }: WatchProgressCardProps) {
  const [isRemoving, setIsRemoving] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

  const posterUrl = progress.posterPath
    ? buildImageUrl(progress.posterPath, "w185")
    : null
  const tvUrl = `/tv/${progress.tvShowId}`

  // Format time remaining or show watched count as fallback
  const remainingTimeText =
    progress.timeRemaining > 0
      ? formatRemainingTime(progress.timeRemaining)
      : progress.percentage >= 100
        ? "Complete"
        : ""

  // Format next episode text - show "Caught up!" when no next episode
  const nextEpisodeText = progress.nextEpisode
    ? progress.nextEpisode.title
      ? `S${progress.nextEpisode.season}E${progress.nextEpisode.episode}: ${progress.nextEpisode.title}`
      : `S${progress.nextEpisode.season}E${progress.nextEpisode.episode}`
    : "Caught up!"

  // Determine progress width (use actual percentage or fallback)
  const progressWidth = progress.percentage > 0 ? progress.percentage : 0

  const handleRemove = async () => {
    if (isRemoving) return

    setIsRemoving(true)
    try {
      await episodeTrackingService.clearAllEpisodes(progress.tvShowId)
      setDialogOpen(false)
    } catch (error) {
      console.error("Failed to remove watch progress:", error)
      setIsRemoving(false)
    }
  }

  const handleTriggerClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  return (
    <div className="group relative flex gap-4 rounded-xl bg-card p-4 transition-colors hover:bg-card/80">
      {/* Remove Button - Shows on Hover */}
      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogTrigger
          onClick={handleTriggerClick}
          disabled={isRemoving}
          className="absolute top-2 right-2 z-10 flex items-center justify-center w-7 h-7 rounded-full bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-red-600 hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label={`Remove ${progress.tvShowName} from watch progress`}
        >
          <HugeiconsIcon
            icon={Delete02Icon}
            className={`size-4 ${isRemoving ? "animate-pulse" : ""}`}
          />
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from Watch Progress?</AlertDialogTitle>
            <AlertDialogDescription>
              This will unmark all {progress.watchedCount} watched episodes for{" "}
              <span className="font-semibold text-white">
                {progress.tvShowName}
              </span>
              . You can always re-add them later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              disabled={isRemoving}
              variant="destructive"
            >
              {isRemoving ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* TV Show Poster */}
      <Link href={tvUrl} className="shrink-0">
        <div className="relative aspect-2/3 w-16 overflow-hidden rounded-lg bg-gray-800 sm:w-20">
          {posterUrl ? (
            <img
              src={posterUrl}
              alt={progress.tvShowName}
              className="absolute inset-0 h-full w-full object-cover"
              sizes="80px"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-gray-500">
              No Image
            </div>
          )}
        </div>
      </Link>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {/* Title Row */}
        <div className="flex items-start justify-between gap-2">
          <Link
            href={tvUrl}
            className="truncate font-semibold text-white hover:text-primary transition-colors"
          >
            {progress.tvShowName}
          </Link>
        </div>

        {/* Next Episode */}
        {nextEpisodeText && (
          <div className="flex items-center gap-1 text-sm">
            <span className="text-primary font-medium">Next:</span>
            <span className="truncate text-gray-300">{nextEpisodeText}</span>
          </div>
        )}

        {/* Time Remaining + Progress Bar */}
        <div className="mt-auto flex flex-col gap-1">
          {remainingTimeText && (
            <span className="text-xs text-gray-400">{remainingTimeText}</span>
          )}
          <div className="flex items-center gap-3">
            <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-primary/10">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-primary transition-all"
                style={{ width: `${Math.min(progressWidth, 100)}%` }}
              />
            </div>
            <span className="shrink-0 text-xs text-gray-400">
              {progress.percentage > 0
                ? `${progress.percentage}%`
                : `${progress.watchedCount} ep`}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
