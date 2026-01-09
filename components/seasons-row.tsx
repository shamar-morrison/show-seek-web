"use client"

import { ScrollableRow } from "@/components/ui/scrollable-row"
import { Section } from "@/components/ui/section"
import { useEpisodeTracking } from "@/hooks/use-episode-tracking"
import type { TMDBSeason } from "@/types/tmdb"
import Link from "next/link"
import { useMemo } from "react"

interface SeasonsRowProps {
  title: string
  seasons: TMDBSeason[]
  tvShowId: number
  limit?: number
}

/**
 * Calculate watched episode count for a specific season
 */
function getSeasonWatchedCount(
  tracking: Map<string, { episodes: Record<string, unknown> }>,
  tvShowId: number,
  seasonNumber: number,
): number {
  const showTracking = tracking.get(tvShowId.toString())
  if (!showTracking?.episodes) return 0

  // Count episodes matching this season number
  // Keys are formatted as "{seasonNumber}_{episodeNumber}"
  return Object.keys(showTracking.episodes).filter((key) => {
    const match = key.match(/^(\d+)_\d+$/)
    return match && parseInt(match[1], 10) === seasonNumber
  }).length
}

/**
 * A horizontally scrollable row of season cards.
 * Displays season poster, name, episode count, and watch progress.
 */
export function SeasonsRow({
  title,
  seasons,
  tvShowId,
  limit,
}: SeasonsRowProps) {
  // Call hooks unconditionally to comply with React's Rules of Hooks
  const { tracking, loading } = useEpisodeTracking()

  // Memoize displaySeasons to avoid unnecessary recomputations
  const displaySeasons = useMemo(
    () => (limit ? seasons?.slice(0, limit) : (seasons ?? [])),
    [seasons, limit],
  )

  // Pre-compute watched counts for all displayed seasons
  const seasonProgress = useMemo(() => {
    const progress: Record<number, number> = {}
    for (const season of displaySeasons) {
      progress[season.season_number] = getSeasonWatchedCount(
        tracking,
        tvShowId,
        season.season_number,
      )
    }
    return progress
  }, [tracking, tvShowId, displaySeasons])

  // Early return after hooks are called
  if (!seasons || seasons.length === 0) return null

  return (
    <Section title={title}>
      <ScrollableRow className="pb-4">
        {displaySeasons.map((season) => {
          const watchedCount = seasonProgress[season.season_number] || 0
          const totalCount = season.episode_count || 0
          const progressPercentage =
            totalCount > 0 ? Math.round((watchedCount / totalCount) * 100) : 0
          const hasProgress = watchedCount > 0

          return (
            <Link
              key={season.id}
              href={`/tv/${tvShowId}/season/${season.season_number}`}
              className="w-[140px] shrink-0 sm:w-[160px]"
            >
              <div className="group relative h-full w-full overflow-hidden rounded-xl bg-card transition-all duration-300">
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

                  {/* Progress Bar - only show if user has watched any episodes */}
                  {hasProgress && !loading && (
                    <div className="mt-1 flex items-center gap-2">
                      <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-primary/10">
                        <div
                          className="absolute inset-y-0 left-0 rounded-full bg-primary transition-all"
                          style={{
                            width: `${Math.min(progressPercentage, 100)}%`,
                          }}
                        />
                      </div>
                      <span className="shrink-0 text-xs text-gray-400">
                        {watchedCount}/{totalCount}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </Link>
          )
        })}
      </ScrollableRow>
    </Section>
  )
}
