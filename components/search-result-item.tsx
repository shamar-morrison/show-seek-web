"use client"

import { buildImageUrl } from "@/lib/tmdb"
import type { TMDBSearchResult } from "@/types/tmdb"
import {
  Film01Icon,
  StarIcon,
  Tv01Icon,
  UserIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import Image from "next/image"

interface SearchResultItemProps {
  result: TMDBSearchResult
  onClick?: () => void
}

/**
 * Search Result Item Component
 * Displays a single search result with image, title, media type, year, and rating
 */
export function SearchResultItem({ result, onClick }: SearchResultItemProps) {
  const isMovie = result.media_type === "movie"
  const isTV = result.media_type === "tv"
  const isPerson = result.media_type === "person"

  // Get display title
  const title = result.title || result.name || "Unknown"

  // Get image URL - use poster for movies/TV, profile for people
  const imagePath = isPerson ? result.profile_path : result.poster_path
  const imageUrl = buildImageUrl(imagePath ?? null, "w92")

  // Get release year
  const dateStr = isMovie ? result.release_date : result.first_air_date
  const year = dateStr ? dateStr.split("-")[0] : null

  // Get rating (not applicable for people)
  const rating =
    result.vote_average && !isPerson
      ? Math.round(result.vote_average * 10) / 10
      : null

  // Get media type label and icon
  const getMediaTypeInfo = () => {
    if (isMovie) {
      return { label: "Movie", icon: Film01Icon }
    }
    if (isTV) {
      return { label: "TV", icon: Tv01Icon }
    }
    return { label: result.known_for_department || "Person", icon: UserIcon }
  }

  const mediaTypeInfo = getMediaTypeInfo()

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-white/10"
    >
      {/* Image */}
      <div className="relative h-16 w-11 shrink-0 overflow-hidden rounded-md bg-gray-800">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={title}
            fill
            className="object-cover"
            sizes="44px"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <HugeiconsIcon
              icon={mediaTypeInfo.icon}
              className="size-5 text-gray-500"
            />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
        {/* Title */}
        <span className="truncate text-sm font-semibold text-white">
          {title}
        </span>

        {/* Meta info */}
        <div className="flex items-center gap-2 text-xs text-gray-400">
          {/* Media type badge */}
          <span className="flex items-center gap-1">
            <HugeiconsIcon icon={mediaTypeInfo.icon} className="size-3" />
            {mediaTypeInfo.label}
          </span>

          {/* Year */}
          {year && (
            <>
              <span className="text-gray-600">•</span>
              <span>{year}</span>
            </>
          )}

          {/* Rating */}
          {rating !== null && rating > 0 && (
            <>
              <span className="text-gray-600">•</span>
              <span className="flex items-center gap-0.5 text-yellow-500">
                <HugeiconsIcon icon={StarIcon} className="size-3" />
                {rating}
              </span>
            </>
          )}
        </div>
      </div>
    </button>
  )
}
