"use client"

import { Button } from "@/components/ui/button"
import { buildImageUrl } from "@/lib/tmdb"
import type { TMDBMedia } from "@/types/tmdb"
import { Loading03Icon, PlayIcon } from "@hugeicons/core-free-icons"
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
}

export function MediaCard({
  media,
  onWatchTrailer,
  priority = false,
  isLoading = false,
  buttonText = "Trailer",
}: MediaCardProps) {
  const title = media.title || media.name || "Unknown Title"
  const date = media.release_date || media.first_air_date
  const year = date ? date.split("-")[0] : null
  const posterUrl = buildImageUrl(media.poster_path, "w500")
  const mediaType = media.media_type === "movie" ? "Movie" : "TV Show"

  // Determine the detail page URL based on media type
  const detailUrl =
    media.media_type === "movie" ? `/movie/${media.id}` : `/tv/${media.id}`

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
        </div>

        {/* Info Content */}
        <div className="flex flex-col gap-3 p-3">
          <div>
            <h3 className="line-clamp-1 text-base font-bold text-white ">
              {title}
            </h3>
            <div className="text-xs font-medium text-gray-400">
              {year} {mediaType}
            </div>
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
