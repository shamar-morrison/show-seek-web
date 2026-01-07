"use client"

import { buildImageUrl } from "@/lib/tmdb"
import type { Rating } from "@/types/rating"
import { StarIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import Image from "next/image"
import Link from "next/link"

interface EpisodeRatingCardProps {
  /** The episode rating data */
  rating: Rating
}

/**
 * EpisodeRatingCard Component
 * Displays a rated episode with poster, show info, episode details, and rating badge
 */
export function EpisodeRatingCard({ rating }: EpisodeRatingCardProps) {
  const posterUrl = buildImageUrl(rating.posterPath, "w500")
  const tvShowName = rating.tvShowName || "Unknown Show"
  const seasonEpisode = `S${rating.seasonNumber || 0} E${rating.episodeNumber || 0}`
  const episodeName = rating.episodeName || "Unknown Episode"
  const href = `/tv/${rating.tvShowId}`

  return (
    <Link href={href} className="block group">
      <div className="relative w-full overflow-hidden rounded-xl bg-card shadow-md transition-all duration-300">
        {/* Poster Image */}
        <div className="relative aspect-2/3 w-full overflow-hidden bg-gray-900">
          {posterUrl ? (
            <Image
              src={posterUrl}
              alt={tvShowName}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 15vw"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gray-800 text-gray-500">
              No Image
            </div>
          )}

          {/* User Rating Badge */}
          <div className="absolute top-2 right-2 flex items-center gap-1 rounded-md bg-black/80 px-2 py-1 backdrop-blur-sm">
            <HugeiconsIcon
              icon={StarIcon}
              className="size-3.5 fill-yellow-500 text-yellow-500"
            />
            <span className="text-sm font-semibold text-white">
              {rating.rating}/10
            </span>
          </div>

          {/* Season/Episode Badge */}
          <div className="absolute bottom-2 left-2 rounded-md bg-primary/90 px-2 py-1 backdrop-blur-sm">
            <span className="text-xs font-bold text-white">
              {seasonEpisode}
            </span>
          </div>
        </div>

        {/* Info Content */}
        <div className="p-3 space-y-1">
          <h3 className="line-clamp-1 text-base font-bold text-white">
            {tvShowName}
          </h3>
          <p className="line-clamp-1 text-sm text-gray-400">{episodeName}</p>
        </div>
      </div>
    </Link>
  )
}
