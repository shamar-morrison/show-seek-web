"use client"

import { Section } from "@/components/ui/section"
import { ViewAllLink } from "@/components/ui/view-all-link"
import type { TMDBSeason } from "@/types/tmdb"

interface SeasonsRowProps {
  title: string
  seasons: TMDBSeason[]
  limit?: number
}

/**
 * A horizontally scrollable row of season cards.
 * Displays season poster, name, and episode count.
 */
export function SeasonsRow({ title, seasons, limit }: SeasonsRowProps) {
  if (!seasons || seasons.length === 0) return null

  const displaySeasons = limit ? seasons.slice(0, limit) : seasons

  return (
    <Section title={title} headerExtra={<ViewAllLink disabled />}>
      <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-4">
        {displaySeasons.map((season) => (
          <div key={season.id} className="w-[140px] shrink-0 sm:w-[160px]">
            <div className="group relative h-full w-full overflow-hidden rounded-xl bg-card shadow-md transition-all duration-300">
              {/* Poster Image */}
              <div className="relative aspect-2/3 w-full overflow-hidden bg-gray-900">
                {season.poster_path ? (
                  <img
                    src={`https://image.tmdb.org/t/p/w500${season.poster_path}`}
                    alt={season.name}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gray-800 text-gray-500">
                    No Image
                  </div>
                )}
              </div>

              {/* Info Content */}
              <div className="flex flex-col gap-1 p-3">
                <h3 className="line-clamp-1 text-sm font-bold text-white">
                  {season.name}
                </h3>
                <p className="text-xs font-medium text-gray-400">
                  {season.episode_count}{" "}
                  {season.episode_count === 1 ? "Episode" : "Episodes"}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Section>
  )
}
