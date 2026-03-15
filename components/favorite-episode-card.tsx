"use client"

import { buildImageUrl } from "@/lib/tmdb"
import { formatRelativeTime } from "@/lib/utils"
import type { FavoriteEpisode } from "@/types/favorite-episode"
import Link from "next/link"

interface FavoriteEpisodeCardProps {
  episode: FavoriteEpisode
}

export function FavoriteEpisodeCard({ episode }: FavoriteEpisodeCardProps) {
  const posterUrl = buildImageUrl(episode.posterPath, "w500")
  const addedAtLabel = formatRelativeTime(episode.addedAt)

  return (
    <Link
      href={`/tv/${episode.tvShowId}/season/${episode.seasonNumber}/episode/${episode.episodeNumber}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-white/5 bg-card transition-all duration-200 hover:border-white/10 hover:bg-card/90"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-white/5">
        {posterUrl ? (
          <img
            src={posterUrl}
            alt={`${episode.showName} poster`}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-gray-500">
            No Image
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
        <div className="space-y-1.5">
          <p className="truncate text-xs font-semibold uppercase text-gray-400">
            {episode.showName}
          </p>
          <h3 className="line-clamp-2 text-lg font-semibold text-white transition-colors group-hover:text-primary">
            {episode.episodeName}
          </h3>
          <p className="text-sm text-gray-400">
            Season {episode.seasonNumber} Episode {episode.episodeNumber}
          </p>
        </div>
        <p className="mt-auto text-xs text-gray-500">Added {addedAtLabel}</p>
      </div>
    </Link>
  )
}
