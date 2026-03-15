"use client"

import { buildImageUrl } from "@/lib/tmdb"
import type { FavoriteEpisode } from "@/types/favorite-episode"
import Link from "next/link"

interface FavoriteEpisodeCardProps {
  episode: FavoriteEpisode
}

export function FavoriteEpisodeCard({ episode }: FavoriteEpisodeCardProps) {
  const posterUrl = buildImageUrl(episode.posterPath, "w185")

  return (
    <Link
      href={`/tv/${episode.tvShowId}/season/${episode.seasonNumber}/episode/${episode.episodeNumber}`}
      className="group flex gap-4 rounded-xl bg-card p-4 transition-colors hover:bg-card/80"
    >
      <div className="relative aspect-[2/3] w-16 shrink-0 overflow-hidden rounded-lg bg-gray-800 sm:w-20">
        {posterUrl ? (
          <img
            src={posterUrl}
            alt={episode.showName}
            className="absolute inset-0 h-full w-full object-cover"
            sizes="80px"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-gray-500">
            No Image
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="mb-1 truncate text-xs font-semibold uppercase tracking-wide text-gray-400">
          {episode.showName}
        </p>
        <h3 className="truncate text-base font-semibold text-white transition-colors group-hover:text-primary">
          {episode.episodeName}
        </h3>
        <p className="mt-1 text-sm text-gray-400">
          Season {episode.seasonNumber} Episode {episode.episodeNumber}
        </p>
      </div>
    </Link>
  )
}
