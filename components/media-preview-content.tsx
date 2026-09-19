"use client"

import {
  getMarkAsWatchedToneClassName,
  MarkAsWatchedButton,
} from "@/components/mark-as-watched-button"
import { RateButton } from "@/components/rate-button"
import { Button } from "@/components/ui/button"
import { useLists } from "@/hooks/use-lists"
import { useNotes } from "@/hooks/use-notes"
import { usePreferences } from "@/hooks/use-preferences"
import { useRatings } from "@/hooks/use-ratings"
import { resolveAddToListAppearance } from "@/lib/add-to-list-appearance"
import { getDisplayMediaTitle } from "@/lib/media-title"
import { formatTmdbDate } from "@/lib/tmdb-date"
import { cn } from "@/lib/utils"
import type { TMDBMovieDetails, TMDBTVDetails } from "@/types/tmdb"
import {
  CalendarIcon,
  InformationCircleIcon,
  Loading03Icon,
  Note01Icon,
  NoteDoneIcon,
  Refresh01Icon,
  StarIcon,
  Tick02Icon,
  Tv01FreeIcons,
  ViewIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import Link from "next/link"
import { useMemo } from "react"

interface MediaPreviewContentProps {
  media: TMDBMovieDetails | TMDBTVDetails
  mediaType: "movie" | "tv"
  /** Whether to prefer original-language titles when available */
  preferOriginalTitles?: boolean
  /** Callback when Add to List button is clicked */
  onAddToList: () => void
  /** Callback when Rate button is clicked */
  onRate: () => void
  /** Callback when Notes button is clicked */
  onNotes: () => void
  /** Callback when Mark as Watched button is clicked (movies only) */
  onMarkAsWatched?: () => void
  /** Watch count for the movie (movies only) */
  watchCount?: number
  /** Whether mark as watched is loading (movies only) */
  isMarkAsWatchedLoading?: boolean
  /** TV show watch trigger state (TV only). Dialogs are owned by the parent. */
  tvWatchTrigger?: {
    visible: boolean
    label: string
    isShowFullyWatched: boolean
    fillRatio: number
    isPending: boolean
    isLoading: boolean
    isError: boolean
  }
  /** Called when the TV watch trigger is clicked */
  onTvWatchClick?: () => void
  /** Called when the TV watch retry button is clicked */
  onTvRetryWatchStatus?: () => void
}

interface Creator {
  id: number
  name: string
}

/**
 * Extracts director from movie credits
 */
function getDirector(media: TMDBMovieDetails): Creator[] {
  const directors =
    media.credits?.crew.filter((c) => c.job === "Director") ?? []
  return directors.map((d) => ({ id: d.id, name: d.name }))
}

/**
 * Extracts creator(s) from TV show details
 */
function getCreator(media: TMDBTVDetails): Creator[] {
  if (media.created_by && media.created_by.length > 0) {
    return media.created_by.map((c) => ({ id: c.id, name: c.name }))
  }
  return []
}

/**
 * Media preview card content - displays detailed info in a hover card.
 * Does not render modals - those are handled by the parent component.
 */
export function MediaPreviewContent({
  media,
  mediaType,
  preferOriginalTitles,
  onAddToList,
  onRate,
  onNotes,
  onMarkAsWatched,
  watchCount = 0,
  isMarkAsWatchedLoading = false,
  tvWatchTrigger,
  onTvWatchClick,
  onTvRetryWatchStatus,
}: MediaPreviewContentProps) {
  const { lists } = useLists()
  const { getRating } = useRatings()
  const { getNote } = useNotes()
  const { preferences } = usePreferences()

  // Get user's rating for this media
  const userRating = useMemo(() => {
    return getRating(mediaType, media.id)
  }, [getRating, mediaType, media.id])

  // Get user's note for this media
  const userNote = useMemo(() => {
    return getNote(mediaType, media.id)
  }, [getNote, mediaType, media.id])

  const addToListAppearance = useMemo(
    () => resolveAddToListAppearance(lists, media.id, mediaType),
    [lists, media.id, mediaType],
  )
  const isInAnyList = addToListAppearance.isInAnyList

  // Extract common properties
  const title =
    getDisplayMediaTitle(
      media,
      preferOriginalTitles ?? preferences.showOriginalTitles,
    ) || "Unknown"
  const overview = media.overview || "No description available."
  const rating = Math.round(media.vote_average * 10) / 10

  // Extract type-specific properties
  const releaseDate =
    mediaType === "movie"
      ? (media as TMDBMovieDetails).release_date
      : (media as TMDBTVDetails).first_air_date

  const creators =
    mediaType === "movie"
      ? getDirector(media as TMDBMovieDetails)
      : getCreator(media as TMDBTVDetails)

  const creatorLabel = mediaType === "movie" ? "Director" : "Creator"

  return (
    <div className="flex w-80 flex-col gap-3 p-4">
      {/* Title */}
      <h3 className="text-lg font-bold text-white">{title}</h3>

      {/* Stats Row */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-300">
        {/* Rating */}
        {rating > 0 && (
          <span className="flex items-center gap-1 font-medium text-yellow-500">
            <HugeiconsIcon icon={StarIcon} className="size-3 fill-yellow-500" />
            <span className="text-gray-300">{rating}</span>
          </span>
        )}
        {/* Release Date */}
        {releaseDate && (
          <span className="flex items-center gap-1">
            <HugeiconsIcon
              icon={CalendarIcon}
              className="size-3 text-gray-500"
            />
            {formatTmdbDate(releaseDate)}
          </span>
        )}
        {/* Episode Count (TV only) */}
        {mediaType === "tv" &&
          (media as TMDBTVDetails).number_of_episodes > 0 && (
            <span className="flex items-center gap-1">
              <HugeiconsIcon
                icon={Tv01FreeIcons}
                className="size-3 text-gray-500"
              />
              {(media as TMDBTVDetails).number_of_episodes} Eps
            </span>
          )}
        {/* Status (TV only - when Ended or Canceled) */}
        {mediaType === "tv" &&
          ((media as TMDBTVDetails).status === "Ended" ||
            (media as TMDBTVDetails).status === "Canceled") && (
            <span className="flex items-center gap-1">
              <HugeiconsIcon
                icon={InformationCircleIcon}
                className="size-3 text-gray-500"
              />
              {(media as TMDBTVDetails).status}
            </span>
          )}
      </div>

      {/* Director/Creator */}
      {creators.length > 0 && (
        <div className="text-xs text-gray-400">
          <span className="font-medium text-gray-300">{creatorLabel}: </span>
          {creators.slice(0, 2).map((c, i) => (
            <span key={c.id}>
              {i > 0 && ", "}
              <Link
                href={`/person/${c.id}`}
                className="hover:text-primary transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                {c.name}
              </Link>
            </span>
          ))}
        </div>
      )}

      {/* Overview */}
      <p
        className={`line-clamp-4 text-sm leading-relaxed text-gray-300 ${
          preferences.blurPlotSpoilers
            ? "blur-md transition-all duration-300 hover:blur-none"
            : ""
        }`}
      >
        {overview}
      </p>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-2 pt-2">
        {/* Add to List */}
        <Button
          size="sm"
          variant="outline"
          className={cn(
            "border-white/20 bg-white/5 text-xs font-semibold text-white backdrop-blur-sm transition-all hover:border-white/40 hover:bg-white/10 dark:border-white/20 dark:bg-white/5 dark:hover:border-white/40 dark:hover:bg-white/10",
            addToListAppearance.buttonClassName,
          )}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onAddToList()
          }}
        >
          <HugeiconsIcon
            icon={addToListAppearance.icon}
            data-add-to-list-icon={addToListAppearance.iconKey}
            className="size-3.5"
          />
          {isInAnyList ? "Added" : "Add"}
        </Button>

        {/* Rate */}
        <RateButton
          hasRating={!!userRating}
          rating={userRating?.rating}
          size="sm"
          onClick={(e) => {
            e?.preventDefault()
            e?.stopPropagation()
            onRate()
          }}
        />

        {/* Notes */}
        <Button
          size="sm"
          variant="outline"
          className="border-white/20 bg-white/5 text-xs font-semibold text-white backdrop-blur-sm transition-all hover:border-white/40 hover:bg-white/10"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onNotes()
          }}
        >
          <HugeiconsIcon
            icon={userNote ? NoteDoneIcon : Note01Icon}
            className={`size-3.5 ${userNote ? "text-primary" : ""}`}
          />
          {userNote ? "Note" : "Notes"}
        </Button>

        {/* Mark as Watched - Movies only */}
        {mediaType === "movie" && onMarkAsWatched && (
          <MarkAsWatchedButton
            watchCount={watchCount}
            isLoading={isMarkAsWatchedLoading}
            size="sm"
            onClick={(e) => {
              e?.preventDefault()
              e?.stopPropagation()
              onMarkAsWatched()
            }}
          />
        )}

        {/* Mark as Watched - TV shows (trigger only; dialogs owned by parent) */}
        {mediaType === "tv" && tvWatchTrigger?.visible && (
          <>
            {tvWatchTrigger.isLoading ? (
              <Button
                size="sm"
                variant="outline"
                disabled
                data-testid="tv-show-watch-button-loading"
                className="border-white/20 bg-white/5 text-xs font-semibold text-white backdrop-blur-sm"
              >
                <HugeiconsIcon
                  icon={Loading03Icon}
                  className="size-3.5 animate-spin"
                />
                <span>Loading…</span>
              </Button>
            ) : tvWatchTrigger.isError ? (
              <Button
                size="sm"
                variant="outline"
                data-testid="tv-show-watch-button-retry"
                className="border-red-500/40 bg-red-500/10 text-xs font-semibold text-red-300 backdrop-blur-sm transition-all hover:border-red-500/60 hover:bg-red-500/20 hover:text-red-200"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onTvRetryWatchStatus?.()
                }}
              >
                <HugeiconsIcon icon={Refresh01Icon} className="size-3.5" />
                <span>Retry watch status</span>
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                data-testid="tv-show-watch-button"
                disabled={tvWatchTrigger.isPending}
                className={cn(
                  getMarkAsWatchedToneClassName(
                    tvWatchTrigger.isShowFullyWatched,
                  ),
                  "relative overflow-hidden text-xs font-semibold backdrop-blur-sm transition-all",
                )}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onTvWatchClick?.()
                }}
              >
                {tvWatchTrigger.fillRatio > 0 && (
                  <span
                    data-testid="tv-show-watch-fill"
                    aria-hidden="true"
                    className={cn(
                      "pointer-events-none absolute inset-y-0 left-0 transition-[width] duration-300 ease-out",
                      tvWatchTrigger.isShowFullyWatched
                        ? "bg-green-500/30"
                        : "bg-primary/30",
                    )}
                    style={{ width: `${tvWatchTrigger.fillRatio * 100}%` }}
                  />
                )}
                {tvWatchTrigger.isPending ? (
                  <HugeiconsIcon
                    icon={Loading03Icon}
                    className="relative z-10 size-3.5 animate-spin"
                  />
                ) : (
                  <HugeiconsIcon
                    icon={
                      tvWatchTrigger.isShowFullyWatched ? Tick02Icon : ViewIcon
                    }
                    className={cn(
                      "relative z-10 size-3.5",
                      tvWatchTrigger.isShowFullyWatched && "text-green-500",
                    )}
                  />
                )}
                <span
                  className={cn(
                    "relative z-10",
                    tvWatchTrigger.isShowFullyWatched && "text-green-500",
                  )}
                >
                  {tvWatchTrigger.label}
                </span>
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

/**
 * Loading skeleton for the preview card
 */
export function MediaPreviewSkeleton() {
  return (
    <div className="flex w-80 animate-pulse flex-col gap-3 p-4">
      {/* Title skeleton */}
      <div className="h-6 w-3/4 rounded bg-white/10" />

      {/* Stats row skeleton */}
      <div className="flex gap-3">
        <div className="h-4 w-16 rounded bg-white/10" />
        <div className="h-4 w-20 rounded bg-white/10" />
        <div className="h-4 w-14 rounded bg-white/10" />
      </div>

      {/* Creator skeleton */}
      <div className="h-4 w-1/2 rounded bg-white/10" />

      {/* Overview skeleton */}
      <div className="space-y-2">
        <div className="h-3 w-full rounded bg-white/10" />
        <div className="h-3 w-full rounded bg-white/10" />
        <div className="h-3 w-full rounded bg-white/10" />
        <div className="h-3 w-2/3 rounded bg-white/10" />
      </div>

      {/* Buttons skeleton */}
      <div className="flex gap-2 pt-2">
        <div className="h-8 w-16 rounded bg-white/10" />
        <div className="h-8 w-16 rounded bg-white/10" />
        <div className="h-8 w-16 rounded bg-white/10" />
      </div>
    </div>
  )
}
