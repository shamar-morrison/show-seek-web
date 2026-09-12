"use client"

import { MarkEntireShowWatchedButton } from "@/components/mark-entire-show-watched-button"
import { ScrollableRow } from "@/components/ui/scrollable-row"
import { Section } from "@/components/ui/section"
import { SeasonCard } from "@/components/season-card"
import { useEpisodeTracking } from "@/hooks/use-episode-tracking"
import type { TMDBSeason } from "@/types/tmdb"
import { useMemo } from "react"

interface SeasonsRowProps {
  title: string
  seasons: TMDBSeason[]
  tvShowId: number
  limit?: number
  tvShowName?: string
  posterPath?: string | null
  voteAverage?: number
  firstAirDate?: string
  totalEpisodes?: number
  avgRuntime?: number
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
  tvShowName,
  posterPath,
  voteAverage,
  firstAirDate,
  totalEpisodes,
  avgRuntime,
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

  const showStats =
    totalEpisodes !== undefined && avgRuntime !== undefined
      ? { totalEpisodes, avgRuntime }
      : undefined

  return (
    <Section
      title={title}
      headerExtra={
        tvShowName ? (
          <div className="mr-auto ml-3 pb-0.5">
            <MarkEntireShowWatchedButton
              tvShowId={tvShowId}
              tvShowName={tvShowName}
              posterPath={posterPath ?? null}
              seasons={seasons}
              showStats={showStats}
              voteAverage={voteAverage}
              firstAirDate={firstAirDate}
            />
          </div>
        ) : undefined
      }
    >
      <ScrollableRow className="pb-4">
        {displaySeasons.map((season) => (
          <SeasonCard
            key={season.id}
            tvShowId={tvShowId}
            tvShowName={tvShowName}
            posterPath={posterPath}
            season={season}
            watchedCount={seasonProgress[season.season_number] || 0}
            totalCount={season.episode_count || 0}
            trackingLoading={loading}
            tracking={tracking}
            showStats={showStats}
          />
        ))}
      </ScrollableRow>
    </Section>
  )
}
