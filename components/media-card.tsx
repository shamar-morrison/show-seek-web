"use client"

"use client"

import {
  MediaCardDropdownMenu,
  type DropdownMenuItem,
} from "@/components/media-card-dropdown-menu"
import { Button } from "@/components/ui/button"
import { ImageWithFallback } from "@/components/ui/image-with-fallback"
import { usePosterOverrides } from "@/hooks/use-poster-overrides"
import { getDisplayMediaTitle } from "@/lib/media-title"
import { buildImageUrl } from "@/lib/tmdb"
import { cn } from "@/lib/utils"
import { getMediaUrl } from "@/lib/utils"
import { DEFAULT_LISTS, isDefaultList } from "@/types/list"
import type { TMDBMedia } from "@/types/tmdb"
import {
  BookmarkIcon,
  CheckmarkCircle02Icon,
  FavouriteIcon,
  FolderLibraryIcon,
  Loading03Icon,
  PlayIcon,
  StarIcon,
  StopCircleIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import Link from "next/link"

const DEFAULT_LIST_INDICATOR_ORDER = DEFAULT_LISTS.map(({ id }) => id)

interface MediaCardProps {
  media: TMDBMedia
  onWatchTrailer?: (media: TMDBMedia) => void
  priority?: boolean
  isLoading?: boolean
  buttonText?: string
  /** Optional user rating to display as a badge (1-10 scale) */
  userRating?: number | null
  /** Optional dropdown menu items */
  dropdownItems?: DropdownMenuItem[]
  /** Optional list IDs to display indicators for */
  listIds?: string[]
  /** Optional watched badge for collection progress */
  isWatched?: boolean
  /** Whether to prefer original-language titles when available */
  preferOriginalTitles?: boolean
  selectionMode?: boolean
  isSelected?: boolean
  onSelectToggle?: () => void
}

function getVisibleListIndicators(listIds: string[] = []) {
  const defaultListIds = DEFAULT_LIST_INDICATOR_ORDER.filter((listId) =>
    listIds.includes(listId),
  )
  const hasCustomList = listIds.some((listId) => !isDefaultList(listId))

  return hasCustomList ? [...defaultListIds, "custom"] : defaultListIds
}

function getListIndicatorStyle(listId: string) {
  switch (listId) {
    case "favorites":
      return { icon: FavouriteIcon, color: "text-red-500 fill-red-500" }
    case "watchlist":
      return { icon: BookmarkIcon, color: "text-blue-500 fill-blue-500" }
    case "currently-watching":
      return { icon: PlayIcon, color: "text-amber-500 fill-amber-500" }
    case "already-watched":
      return {
        icon: CheckmarkCircle02Icon,
        color: "text-green-500 fill-green-500",
      }
    case "dropped":
      return { icon: StopCircleIcon, color: "text-red-500" }
    case "custom":
      return { icon: FolderLibraryIcon, color: "text-violet-400 fill-violet-400" }
    default:
      return null
  }
}

export function MediaCard({
  media,
  onWatchTrailer,
  priority = false,
  isLoading = false,
  buttonText = "Trailer",
  userRating,
  dropdownItems,
  listIds,
  isWatched = false,
  preferOriginalTitles = false,
  selectionMode = false,
  isSelected = false,
  onSelectToggle,
}: MediaCardProps) {
  const { resolvePosterPath } = usePosterOverrides()
  const title =
    getDisplayMediaTitle(media, preferOriginalTitles) || "Unknown Title"
  const date = media.release_date || media.first_air_date
  const year = date ? date.split("-")[0] : null
  const resolvedPosterPath =
    media.media_type === "movie" || media.media_type === "tv"
      ? resolvePosterPath(media.media_type, media.id, media.poster_path)
      : media.poster_path
  const posterUrl = buildImageUrl(resolvedPosterPath, "w500")
  const hasRating = (media.vote_average || 0) > 0
  const detailUrl = getMediaUrl(media.media_type, media.id)
  const visibleListIndicators = getVisibleListIndicators(listIds)
  const cardContent = (
    <div
      className={cn(
        "group relative w-full cursor-pointer overflow-hidden rounded-xl bg-card p-0 shadow-md transition-all duration-300",
        selectionMode && "border border-white/10 hover:border-white/20",
        selectionMode && isSelected && "border-primary ring-2 ring-primary/70",
      )}
    >
      <div className="relative aspect-2/3 w-full overflow-hidden bg-gray-900">
        <ImageWithFallback
          src={posterUrl}
          alt={title}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 15vw"
          priority={priority}
        />

        {dropdownItems && dropdownItems.length > 0 && !selectionMode ? (
          <MediaCardDropdownMenu
            items={dropdownItems}
            className="absolute top-2 right-2"
          />
        ) : null}

        {selectionMode ? (
          <div className="absolute top-2 right-2 rounded-full bg-black/75 px-2 py-1 text-xs font-semibold text-white backdrop-blur-sm">
            {isSelected ? "Selected" : "Select"}
          </div>
        ) : null}

        <div className="absolute top-2 left-2 flex flex-col gap-2">
          {isWatched && (
            <div className="flex w-fit items-center gap-1 rounded-md bg-green-500/85 px-2 py-1 backdrop-blur-sm">
              <HugeiconsIcon
                icon={CheckmarkCircle02Icon}
                className="size-3.5 fill-white text-white"
              />
              <span className="text-sm font-semibold text-white">
                Watched
              </span>
            </div>
          )}

          {userRating != null && (
            <div className="flex w-fit items-center gap-1 rounded-md bg-black/80 px-2 py-1 backdrop-blur-sm">
              <HugeiconsIcon
                icon={StarIcon}
                className="size-3.5 fill-yellow-500 text-yellow-500"
              />
              <span className="text-sm font-semibold text-white">
                {userRating}/10
              </span>
            </div>
          )}

          {visibleListIndicators.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {visibleListIndicators.map((listId) => {
                const indicator = getListIndicatorStyle(listId)
                if (!indicator) return null
                return (
                  <div
                    key={listId}
                    data-list-indicator={listId}
                    title={listId === "custom" ? "custom" : listId}
                    className="flex items-center justify-center rounded-md bg-black/80 p-1.5 backdrop-blur-sm"
                  >
                    <HugeiconsIcon
                      icon={indicator.icon}
                      className={`size-3.5 ${indicator.color}`}
                    />
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {selectionMode ? (
          <div
            className={cn(
              "absolute inset-0 transition-colors",
              isSelected ? "bg-primary/12" : "bg-black/5",
            )}
          />
        ) : null}
      </div>

      <div className="flex flex-col gap-3 p-3">
        <div>
          <h3 className="line-clamp-1 text-base font-bold text-white ">
            {title}
          </h3>
          <div className="flex items-center gap-2 text-xs font-medium text-gray-400">
            {year}
            {year && hasRating && <span className="text-gray-600">•</span>}
            {hasRating && (
              <div className="flex items-center gap-1 text-yellow-500">
                <HugeiconsIcon
                  icon={StarIcon}
                  className="size-3 fill-yellow-500"
                />
                <span>{media.vote_average.toFixed(1)}</span>
              </div>
            )}
          </div>
        </div>

        {onWatchTrailer && !selectionMode ? (
          <Button
            size="sm"
            className="w-full bg-muted font-semibold text-white transition-colors hover:bg-primary group-hover:text-white"
            onClick={(e) => {
              e.preventDefault()
              onWatchTrailer(media)
            }}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <HugeiconsIcon
                  icon={Loading03Icon}
                  className="size-4 animate-spin"
                />
                Loading...
              </>
            ) : (
              <>
                <HugeiconsIcon icon={PlayIcon} className="size-4" />
                {buttonText}
              </>
            )}
          </Button>
        ) : null}
      </div>
    </div>
  )

  if (selectionMode) {
    return (
      <button
        type="button"
        onClick={onSelectToggle}
        aria-pressed={isSelected}
        className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
      >
        {cardContent}
      </button>
    )
  }

  return (
    <Link href={detailUrl} className="block">
      {cardContent}
    </Link>
  )
}
