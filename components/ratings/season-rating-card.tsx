"use client"

import { usePosterOverrides } from "@/hooks/use-poster-overrides"
import { buildImageUrl } from "@/lib/tmdb"
import type { Rating } from "@/types/rating"
import { StarIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import Link from "next/link"

type SeasonRating = Rating & {
  mediaType: "season"
  tvShowId: number
  seasonNumber: number
}

function isValidSeasonRating(rating: Rating): rating is SeasonRating {
  return (
    rating.mediaType === "season" &&
    typeof rating.tvShowId === "number" &&
    typeof rating.seasonNumber === "number"
  )
}

interface SeasonRatingCardProps {
  rating: Rating
}

/**
 * SeasonRatingCard Component
 * Displays a rated TV season with poster, show name, season label, and rating.
 */
export function SeasonRatingCard({ rating }: SeasonRatingCardProps) {
  const { resolvePosterPath } = usePosterOverrides()

  if (!isValidSeasonRating(rating)) {
    return null
  }

  const showTitle = rating.tvShowName || "Unknown Show"
  const seasonLabel = rating.title || `Season ${rating.seasonNumber}`
  const posterPath = resolvePosterPath(
    "tv",
    rating.tvShowId,
    rating.posterPath || null,
  )
  const posterUrl = buildImageUrl(posterPath, "w500")
  const href = `/tv/${rating.tvShowId}/season/${rating.seasonNumber}`

  return (
    <Link href={href} className="block group">
      <div className="relative w-full overflow-hidden rounded-xl bg-card shadow-md transition-all duration-300">
        <div className="relative aspect-2/3 w-full overflow-hidden bg-gray-900">
          {posterUrl ? (
            <img
              src={posterUrl}
              alt={`${showTitle} ${seasonLabel}`}
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 15vw"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gray-800 text-gray-500">
              No Image
            </div>
          )}

          <div className="absolute top-2 right-2 flex items-center gap-1 rounded-md bg-black/80 px-2 py-1 backdrop-blur-sm">
            <HugeiconsIcon
              icon={StarIcon}
              className="size-3.5 fill-yellow-500 text-yellow-500"
            />
            <span className="text-sm font-semibold text-white">
              {rating.rating}/10
            </span>
          </div>
        </div>

        <div className="space-y-1 p-3">
          <h3 className="line-clamp-1 text-base font-bold text-white">
            {showTitle}
          </h3>
          <p className="line-clamp-1 text-sm text-gray-400">{seasonLabel}</p>
        </div>
      </div>
    </Link>
  )
}
