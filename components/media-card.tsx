"use client"

import {
  MediaCardDropdownMenu,
  type DropdownMenuItem,
} from "@/components/media-card-dropdown-menu"
import { Button } from "@/components/ui/button"
import { ImageWithFallback } from "@/components/ui/image-with-fallback"
import { buildImageUrl } from "@/lib/tmdb"
import { getMediaUrl } from "@/lib/utils"
import type { TMDBMedia } from "@/types/tmdb"
import {
  BookmarkIcon,
  CheckmarkCircle02Icon,
  FavouriteIcon,
  Loading03Icon,
  PlayIcon,
  StarIcon,
  StopCircleIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import Link from "next/link"

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
}: MediaCardProps) {
  const title = media.title || media.name || "Unknown Title"
  const date = media.release_date || media.first_air_date
  const year = date ? date.split("-")[0] : null
  const posterUrl = buildImageUrl(media.poster_path, "w500")
  const hasRating = (media.vote_average || 0) > 0
  const detailUrl = getMediaUrl(media.media_type, media.id)

  const getListIcon = (listId: string) => {
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
      default:
        return null
    }
  }

  return (
    <Link href={detailUrl} className="block">
      <div className="group relative w-full overflow-hidden rounded-xl bg-card p-0 shadow-md transition-all duration-300 cursor-pointer">
        {/* Poster Image */}
        <div className="relative aspect-2/3 w-full overflow-hidden bg-gray-900">
          <ImageWithFallback
            src={posterUrl}
            alt={title}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 15vw"
            priority={priority}
          />

          {/* Dropdown Menu - top right */}
          {dropdownItems && dropdownItems.length > 0 && (
            <MediaCardDropdownMenu
              items={dropdownItems}
              className="absolute top-2 right-2"
            />
          )}

          {/* Status Badges - Top Left */}
          <div className="absolute top-2 left-2 flex flex-col gap-2">
            {/* User Rating Badge */}
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

            {/* List Indicators */}
            {listIds && listIds.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {listIds.map((listId) => {
                  const indicator = getListIcon(listId)
                  if (!indicator) return null
                  return (
                    <div
                      key={listId}
                      className="flex items-center justify-center rounded-md bg-black/80 p-1.5 backdrop-blur-sm"
                      title={listId}
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
        </div>

        {/* Info Content */}
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

          {/* Trailer Button - only show when handler is provided */}
          {onWatchTrailer && (
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
          )}
        </div>
      </div>
    </Link>
  )
}
