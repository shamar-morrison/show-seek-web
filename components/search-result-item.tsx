import { getSearchResultInfo } from "@/lib/media-info"
import { buildImageUrl } from "@/lib/tmdb"
import type { TMDBSearchResult } from "@/types/tmdb"
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
  const { title, imagePath, year, rating, mediaTypeLabel, MediaTypeIcon } =
    getSearchResultInfo(result)

  const imageUrl = buildImageUrl(imagePath ?? null, "w92")

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
              icon={MediaTypeIcon}
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
            <HugeiconsIcon icon={MediaTypeIcon} className="size-3" />
            {mediaTypeLabel}
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
                <span className="text-xs text-yellow-500">★</span>
                {rating}
              </span>
            </>
          )}
        </div>
      </div>
    </button>
  )
}
