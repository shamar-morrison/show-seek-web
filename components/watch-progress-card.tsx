"use client"

import {
  formatRemainingTime,
  type WatchProgressItem,
} from "@/hooks/use-episode-tracking"
import { buildImageUrl } from "@/lib/tmdb"
import Image from "next/image"
import Link from "next/link"

interface WatchProgressCardProps {
  /** Watch progress data */
  progress: WatchProgressItem
}

/**
 * WatchProgressCard Component
 * Displays TV show watch progress with poster, title, progress bar, and next episode
 */
export function WatchProgressCard({ progress }: WatchProgressCardProps) {
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

  return (
    <div className="group flex gap-4 rounded-xl bg-card p-4 transition-colors hover:bg-card/80">
      {/* TV Show Poster */}
      <Link href={tvUrl} className="shrink-0">
        <div className="relative aspect-2/3 w-16 overflow-hidden rounded-lg bg-gray-800 sm:w-20">
          {posterUrl ? (
            <Image
              src={posterUrl}
              alt={progress.tvShowName}
              fill
              className="object-cover"
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
          <span className="shrink-0 text-sm text-gray-400">
            {remainingTimeText}
          </span>
        </div>

        {/* Next Episode */}
        {nextEpisodeText && (
          <div className="flex items-center gap-1 text-sm">
            <span className="text-primary font-medium">Next:</span>
            <span className="truncate text-gray-300">{nextEpisodeText}</span>
          </div>
        )}

        {/* Progress Bar */}
        <div className="mt-auto flex items-center gap-3">
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
  )
}
