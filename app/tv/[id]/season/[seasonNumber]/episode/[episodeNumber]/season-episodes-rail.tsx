"use client"

import { ScrollableRow } from "@/components/ui/scrollable-row"
import { Section } from "@/components/ui/section"
import { buildImageUrl } from "@/lib/tmdb"
import { cn } from "@/lib/utils"
import type { TMDBSeasonEpisode } from "@/types/tmdb"
import { CheckmarkCircle02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import Link from "next/link"
import { useMemo } from "react"

interface SeasonEpisodesRailProps {
  tvShowId: number
  seasonNumber: number
  episodes: TMDBSeasonEpisode[]
  currentEpisodeNumber: number
  watchedEpisodes: Record<string, boolean>
}

export function SeasonEpisodesRail({
  tvShowId,
  seasonNumber,
  episodes,
  currentEpisodeNumber,
  watchedEpisodes,
}: SeasonEpisodesRailProps) {
  const sortedEpisodes = useMemo(
    () => [...episodes].sort((a, b) => a.episode_number - b.episode_number),
    [episodes],
  )

  if (sortedEpisodes.length <= 1) {
    return null
  }

  return (
    <Section title="More Episodes" className="pb-12 pt-8">
      <ScrollableRow className="pb-4">
        {sortedEpisodes.map((seasonEpisode) => {
          const isCurrent =
            seasonEpisode.episode_number === currentEpisodeNumber
          const isWatched =
            watchedEpisodes[
              `${seasonNumber}_${seasonEpisode.episode_number}`
            ] === true
          const card = (
            <EpisodeRailCard
              episode={seasonEpisode}
              isCurrent={isCurrent}
              isWatched={isWatched}
            />
          )

          if (isCurrent) {
            return (
              <div
                key={seasonEpisode.id}
                aria-current="page"
                aria-label={`Current episode ${seasonEpisode.episode_number}: ${seasonEpisode.name}`}
                className="shrink-0"
              >
                {card}
              </div>
            )
          }

          return (
            <Link
              key={seasonEpisode.id}
              href={`/tv/${tvShowId}/season/${seasonNumber}/episode/${seasonEpisode.episode_number}`}
              aria-label={`Open episode ${seasonEpisode.episode_number}: ${seasonEpisode.name}`}
              className="shrink-0"
            >
              {card}
            </Link>
          )
        })}
      </ScrollableRow>
    </Section>
  )
}

function EpisodeRailCard({
  episode,
  isCurrent,
  isWatched,
}: {
  episode: TMDBSeasonEpisode
  isCurrent: boolean
  isWatched: boolean
}) {
  const stillUrl = buildImageUrl(episode.still_path, "w500")

  return (
    <article
      className={cn(
        "group relative w-[280px] overflow-hidden rounded-xl border bg-card/80 transition-all",
        isCurrent
          ? "border-primary/80 ring-1 ring-primary/50"
          : "border-white/10 hover:border-white/20 hover:bg-card",
      )}
    >
      <div className="relative aspect-video overflow-hidden bg-gray-900">
        {stillUrl ? (
          <img
            src={stillUrl}
            alt={episode.name}
            className={cn(
              "absolute inset-0 h-full w-full object-cover transition-transform duration-300",
              !isCurrent && "group-hover:scale-105",
            )}
            loading="lazy"
            sizes="280px"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gray-800 text-sm font-medium text-gray-500">
            No Image
          </div>
        )}

        {isCurrent && (
          <span className="absolute left-3 top-3 rounded-full bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground">
            Current
          </span>
        )}

        {isWatched && (
          <span
            aria-label={`Episode ${episode.episode_number} watched`}
            className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full bg-green-500 text-white shadow-lg"
          >
            <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-4" />
          </span>
        )}
      </div>

      <div className="space-y-1.5 p-4">
        <p className="text-sm font-medium text-gray-400">
          Episode {episode.episode_number}
        </p>
        <h3 className="line-clamp-2 min-h-[3.5rem] text-base font-semibold text-white">
          {episode.name}
        </h3>
      </div>
    </article>
  )
}
