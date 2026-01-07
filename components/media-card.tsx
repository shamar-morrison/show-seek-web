"use client"

import { Button } from "@/components/ui/button"
import { buildImageUrl } from "@/lib/tmdb"
import type { TMDBMedia } from "@/types/tmdb"
import { Loading03Icon, PlayIcon, StarIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import Image from "next/image"
import Link from "next/link"

interface MediaCardProps {
  media: TMDBMedia
  onWatchTrailer?: (media: TMDBMedia) => void
  onAddToList?: (media: TMDBMedia) => void
  priority?: boolean
  isLoading?: boolean
  buttonText?: string
  showRating?: boolean
  /** Optional user rating to display as a badge (1-10 scale) */
  userRating?: number | null
}

export function MediaCard({
  media,
  onWatchTrailer,
  priority = false,
  isLoading = false,
  buttonText = "Trailer",
  showRating = false,
  userRating,
}: MediaCardProps) {
  const title = media.title || media.name || "Unknown Title"
  const date = media.release_date || media.first_air_date
  const year = date ? date.split("-")[0] : null
  const posterUrl = buildImageUrl(media.poster_path, "w500")
  const mediaType =
    media.media_type === "movie"
      ? "Movie"
      : media.media_type === "tv"
        ? "TV Show"
        : "Person"
  const hasRating = (media.vote_average || 0) > 0

  // Determine the detail page URL based on media type
  const getDetailUrl = (type: string, id: number) => {
    switch (type) {
      case "movie":
        return `/movie/${id}`
      case "tv":
        return `/tv/${id}`
      case "person":
        return `/person/${id}`
      default:
        return "/"
    }
  }

  const detailUrl = getDetailUrl(media.media_type, media.id)

  return (
    <Link href={detailUrl} className="block">
      <div className="group relative w-full overflow-hidden rounded-xl bg-card p-0 shadow-md transition-all duration-300 cursor-pointer">
        {/* Poster Image */}
        <div className="relative aspect-2/3 w-full overflow-hidden bg-gray-900">
          {posterUrl ? (
            <Image
              src={posterUrl}
              alt={title}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 15vw"
              priority={priority}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gray-800 text-gray-500">
              No Image
            </div>
          )}

          {/* User Rating Badge */}
          {userRating != null && (
            <div className="absolute top-2 right-2 flex items-center gap-1 rounded-md bg-black/80 px-2 py-1 backdrop-blur-sm">
              <HugeiconsIcon
                icon={StarIcon}
                className="size-3.5 fill-yellow-500 text-yellow-500"
              />
              <span className="text-sm font-semibold text-white">
                {userRating}/10
              </span>
            </div>
          )}
        </div>

        {/* Info Content */}
        <div className="flex flex-col gap-3 p-3">
          <div>
            <h3 className="line-clamp-1 text-base font-bold text-white ">
              {title}
            </h3>
            {showRating ? (
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
            ) : (
              <div className="text-xs font-medium text-gray-400">
                {year} {mediaType}
              </div>
            )}
          </div>

          {/* Watch Now Button */}
          <Button
            size="sm"
            className="w-full bg-muted font-semibold text-white transition-colors hover:bg-primary group-hover:text-white"
            onClick={(e) => {
              if (onWatchTrailer) {
                e.preventDefault() // Prevent navigation when clicking the button
                onWatchTrailer(media)
              }
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
        </div>
      </div>
    </Link>
  )
}
