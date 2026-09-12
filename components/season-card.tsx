"use client"

import { MediaCardDropdownMenu } from "@/components/media-card-dropdown-menu"
import { useSeasonActions } from "@/hooks/use-season-actions"
import type { TVShowEpisodeTracking } from "@/types/episode-tracking"
import type { TMDBSeason } from "@/types/tmdb"
import Link from "next/link"

interface SeasonCardProps {
  /** TMDB TV show id */
  tvShowId: number
  /** TV show name for tracking metadata and dialogs */
  tvShowName?: string
  /** Show-level poster fallback when the season has none */
  posterPath?: string | null
  /** Season summary */
  season: TMDBSeason
  /** Watched episode count */
  watchedCount: number
  /** Total episode count */
  totalCount: number
  /** Whether tracking is still loading (hides the progress bar) */
  trackingLoading: boolean
  /** Full episode tracking map */
  tracking: Map<string, TVShowEpisodeTracking>
  /** Optional show stats for tracking metadata caching */
  showStats?: {
    totalEpisodes: number
    avgRuntime: number
  }
}

/**
 * SeasonCard Component
 * Season poster card with a hover quick-actions dropdown (mark season
 * watched/unwatched, rate season) so users don't need to navigate to the
 * season details screen. The dropdown trigger lives outside the link and
 * stops propagation so it never triggers navigation.
 */
export function SeasonCard({
  tvShowId,
  tvShowName,
  posterPath,
  season,
  watchedCount,
  totalCount,
  trackingLoading,
  tracking,
  showStats,
}: SeasonCardProps) {
  const { dropdownItems, modals } = useSeasonActions({
    tvShowId,
    tvShowName: tvShowName ?? "",
    posterPath,
    season,
    watchedCount,
    totalCount,
    tracking,
    showStats,
  })

  const progressPercentage =
    totalCount > 0 ? Math.round((watchedCount / totalCount) * 100) : 0
  const hasProgress = watchedCount > 0

  return (
    <div className="group relative w-[140px] shrink-0 sm:w-[160px]">
      <Link
        href={`/tv/${tvShowId}/season/${season.season_number}`}
        className="block h-full w-full"
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
            {hasProgress && !trackingLoading && (
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
      <MediaCardDropdownMenu
        items={dropdownItems}
        className="absolute top-2 right-2 z-10"
      />
      {modals}
    </div>
  )
}
