"use client"

import { buildImageUrl } from "@/lib/tmdb"
import type { Rating } from "@/types/rating"
import type { TMDBMovieDetails, TMDBTVDetails } from "@/types/tmdb"
import { StarIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import Image from "next/image"
import Link from "next/link"

interface RatingCardProps {
  /** The user's rating */
  rating: Rating
  /** TMDB media details (may be null if fetch failed) */
  media: TMDBMovieDetails | TMDBTVDetails | null
  /** Media type for link routing */
  mediaType: "movie" | "tv"
}

/**
 * Get display title from media details
 */
function getMediaTitle(
  media: TMDBMovieDetails | TMDBTVDetails | null,
  fallback: string,
): string {
  if (!media) return fallback
  // Movies have 'title', TV shows have 'name'
  if ("title" in media && media.title) return media.title
  if ("name" in media && media.name) return media.name
  return fallback
}

/**
 * RatingCard Component
 * Displays a rated media item with poster, rating badge, and title
 */
export function RatingCard({ rating, media, mediaType }: RatingCardProps) {
  const title = getMediaTitle(media, rating.title) || "Untitled"
  const posterPath = media?.poster_path || rating.posterPath
  const posterUrl = buildImageUrl(posterPath, "w500")
  const releaseDate =
    (media as TMDBMovieDetails)?.release_date ||
    (media as TMDBTVDetails)?.first_air_date ||
    rating.releaseDate
  const year = releaseDate ? releaseDate.split("-")[0] : null
  const href =
    mediaType === "movie" ? `/movie/${rating.mediaId}` : `/tv/${rating.mediaId}`

  return (
    <Link href={href} className="block group">
      <div className="relative w-full overflow-hidden rounded-xl bg-card shadow-md transition-all duration-300">
        {/* Poster Image */}
        <div className="relative aspect-2/3 w-full overflow-hidden bg-gray-900">
          {posterUrl ? (
            <Image
              src={posterUrl}
              alt={title}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 15vw"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gray-800 text-gray-500">
              No Image
            </div>
          )}

          {/* Rating Badge Overlay */}
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

        {/* Info Content */}
        <div className="p-3">
          <h3 className="line-clamp-1 text-base font-bold text-white">
            {title}
          </h3>
          {year && <p className="text-xs font-medium text-gray-400">{year}</p>}
        </div>
      </div>
    </Link>
  )
}
