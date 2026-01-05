"use client"

import Image from "next/image"
import { Button } from "@/components/ui/button"
import type { TMDBMedia } from "@/types/tmdb"
import { buildImageUrl } from "@/lib/tmdb"
import { PlayIcon, PlusSignIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "@/lib/utils"

interface MediaCardProps {
  media: TMDBMedia
  onWatchTrailer?: (media: TMDBMedia) => void
  onAddToList?: (media: TMDBMedia) => void
  priority?: boolean
}

export function MediaCard({
  media,
  onWatchTrailer,
  priority = false,
}: MediaCardProps) {
  const title = media.title || media.name || "Unknown Title"
  const date = media.release_date || media.first_air_date
  const year = date ? date.split("-")[0] : null
  const posterUrl = buildImageUrl(media.poster_path, "w500")
  const mediaType = media.media_type === "movie" ? "Movie" : "TV Show"

  return (
    <div className="group relative w-full overflow-hidden rounded-xl bg-[#18181b] p-0 shadow-md transition-all duration-300 hover:bg-[#27272a] cursor-pointer">
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
          className="w-full bg-[#2a2a2e] font-semibold text-white transition-colors hover:bg-primary group-hover:text-white"
          onClick={() => onWatchTrailer?.(media)}
        >
          <HugeiconsIcon icon={PlayIcon} className="size-4" />
          Trailer
        </Button>
      </div>
    </div>
  )
}
