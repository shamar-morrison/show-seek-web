"use client"

import { EpisodeRatingModal } from "@/components/episode-rating-modal"
import { useAuth } from "@/context/auth-context"
import { usePreferences } from "@/hooks/use-preferences"
import { useRatings } from "@/hooks/use-ratings"
import { episodeTrackingService } from "@/services/episode-tracking-service"
import type { TMDBSeason, TMDBSeasonEpisode } from "@/types/tmdb"
import {
  CheckmarkCircle02Icon,
  Loading03Icon,
  StarIcon,
  Time02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import Link from "next/link"
import { useCallback, useState } from "react"

interface EpisodeCardProps {
  episode: TMDBSeasonEpisode
  tvShowId: number
  tvShowName: string
  tvShowPosterPath: string | null
  isWatched: boolean
  showStats?: {
    totalEpisodes: number
    avgRuntime: number
  }
  /** All episodes in the current season (for computing next episode) */
  allSeasonEpisodes: TMDBSeasonEpisode[]
  /** All seasons in the TV show (for computing next episode in next season) */
  tvShowSeasons?: TMDBSeason[]
}

/**
 * EpisodeCard Component
 * Displays episode info with watched toggle and rating functionality
 */
export function EpisodeCard({
  episode,
  tvShowId,
  tvShowName,
  tvShowPosterPath,
  isWatched,
  showStats,
  allSeasonEpisodes,
  tvShowSeasons,
}: EpisodeCardProps) {
  const { user } = useAuth()
  const { getEpisodeRating } = useRatings()
  const { preferences } = usePreferences()
  const [isToggling, setIsToggling] = useState(false)
  const [showRatingModal, setShowRatingModal] = useState(false)

  // Check if episode has aired
  const today = new Date()
  const hasAired = episode.air_date && new Date(episode.air_date) <= today

  // Get user's rating for this episode
  const userRating = getEpisodeRating(
    tvShowId,
    episode.season_number,
    episode.episode_number,
  )

  // Format air date
  const formatDate = (dateString: string | null) => {
    if (!dateString) return null
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  // Format runtime
  const formatRuntime = (minutes: number | null) => {
    if (!minutes) return null
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
  }

  // Compute next episode when marking this one as watched
  const computeNextEpisode = useCallback(() => {
    const today = new Date()
    const airedEpisodes = allSeasonEpisodes.filter(
      (ep) => ep.air_date && new Date(ep.air_date) <= today,
    )

    // Find the next unwatched episode in this season
    const currentIndex = airedEpisodes.findIndex(
      (ep) => ep.episode_number === episode.episode_number,
    )

    // Check if there's a next episode in this season
    if (currentIndex >= 0 && currentIndex < airedEpisodes.length - 1) {
      const nextEp = airedEpisodes[currentIndex + 1]
      return {
        season: nextEp.season_number,
        episode: nextEp.episode_number,
        title: nextEp.name,
        airDate: nextEp.air_date,
      }
    }

    // If this is the last episode, check for next season
    if (tvShowSeasons && tvShowSeasons.length > 0) {
      const nextSeasons = tvShowSeasons
        .filter(
          (s) => s.season_number > episode.season_number && s.season_number > 0,
        )
        .sort((a, b) => a.season_number - b.season_number)

      if (nextSeasons.length > 0) {
        const nextSeason = nextSeasons[0]
        return {
          season: nextSeason.season_number,
          episode: 1,
          title: `${nextSeason.name} Episode 1`,
          airDate: nextSeason.air_date || null,
        }
      }
    }

    // No more episodes - user is caught up!
    return null
  }, [allSeasonEpisodes, episode, tvShowSeasons])

  // Toggle watched status
  const handleToggleWatched = useCallback(async () => {
    if (!user || !hasAired || isToggling) return

    setIsToggling(true)
    try {
      if (isWatched) {
        await episodeTrackingService.markEpisodeUnwatched(
          tvShowId,
          episode.season_number,
          episode.episode_number,
        )
      } else {
        // Compute next episode when marking as watched
        const nextEpisode = computeNextEpisode()

        await episodeTrackingService.markEpisodeWatched(
          tvShowId,
          episode.season_number,
          episode.episode_number,
          {
            episodeId: episode.id,
            episodeName: episode.name,
            episodeAirDate: episode.air_date,
          },
          {
            tvShowName,
            posterPath: tvShowPosterPath,
          },
          showStats,
          nextEpisode,
        )
      }
    } catch (error) {
      console.error("Failed to toggle watched status:", error)
    } finally {
      setIsToggling(false)
    }
  }, [
    user,
    hasAired,
    isToggling,
    isWatched,
    tvShowId,
    episode,
    tvShowName,
    tvShowPosterPath,
    showStats,
    computeNextEpisode,
  ])

  const stillUrl = episode.still_path
    ? `https://image.tmdb.org/t/p/w400${episode.still_path}`
    : null

  return (
    <>
      <article className="group relative overflow-hidden rounded-xl bg-card transition-all hover:bg-card/80">
        <div className="flex flex-col sm:flex-row">
          {/* Episode Still - Clickable */}
          <Link
            href={`/tv/${tvShowId}/season/${episode.season_number}/episode/${episode.episode_number}`}
            className="relative aspect-video w-full shrink-0 overflow-hidden bg-gray-900 sm:w-64 md:w-80"
          >
            {stillUrl ? (
              <img
                src={stillUrl}
                alt={episode.name}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-gray-600">
                No Image
              </div>
            )}

            {/* Episode Number Badge */}
            <div className="absolute left-3 top-3 rounded-md bg-black/80 px-2 py-1 text-sm font-bold text-white backdrop-blur-sm">
              E{episode.episode_number}
            </div>

            {/* Watched Overlay */}
            {isWatched && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <HugeiconsIcon
                  icon={CheckmarkCircle02Icon}
                  className="size-12 text-green-500"
                />
              </div>
            )}

            {/* Future Episode Overlay */}
            {!hasAired && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                <span className="rounded-md bg-primary/20 px-3 py-1.5 text-sm font-medium text-primary">
                  Coming {formatDate(episode.air_date)}
                </span>
              </div>
            )}
          </Link>

          {/* Episode Info */}
          <div className="flex flex-1 flex-col justify-between p-4">
            <div>
              {/* Title & Metadata Row */}
              <div className="mb-2 flex items-start justify-between gap-4">
                <h3 className="font-bold text-white line-clamp-1">
                  {episode.name}
                </h3>

                {/* TMDB Rating */}
                {episode.vote_average > 0 && (
                  <div className="flex shrink-0 items-center gap-1 text-sm">
                    <HugeiconsIcon
                      icon={StarIcon}
                      className="size-4 fill-yellow-500 text-yellow-500"
                    />
                    <span className="text-gray-300">
                      {episode.vote_average.toFixed(1)}
                    </span>
                  </div>
                )}
              </div>

              {/* Meta Info */}
              <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-gray-400">
                {episode.air_date && (
                  <span>{formatDate(episode.air_date)}</span>
                )}
                {episode.runtime && (
                  <div className="flex items-center gap-1">
                    <HugeiconsIcon icon={Time02Icon} className="size-3" />
                    <span>{formatRuntime(episode.runtime)}</span>
                  </div>
                )}
              </div>

              {/* Overview */}
              {episode.overview && (
                <p
                  className={`text-sm text-gray-400 line-clamp-2 ${
                    preferences.blurPlotSpoilers
                      ? "blur-md transition-all duration-300 hover:blur-none"
                      : ""
                  }`}
                >
                  {episode.overview}
                </p>
              )}
            </div>

            {/* Actions */}
            {user && hasAired && (
              <div className="mt-4 flex items-center gap-3">
                {/* Watched Toggle */}
                <button
                  onClick={handleToggleWatched}
                  disabled={isToggling}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isWatched
                      ? "bg-green-500/20 text-green-500 hover:bg-green-500/30"
                      : "bg-white/10 text-gray-300 hover:bg-white/20 hover:text-white"
                  }`}
                  aria-label={
                    isWatched ? "Mark as unwatched" : "Mark as watched"
                  }
                >
                  {isToggling ? (
                    <HugeiconsIcon
                      icon={Loading03Icon}
                      className="size-4 animate-spin"
                    />
                  ) : (
                    <HugeiconsIcon
                      icon={CheckmarkCircle02Icon}
                      className="size-4"
                    />
                  )}
                  {isWatched ? "Watched" : "Mark Watched"}
                </button>

                {/* Rate Button */}
                <button
                  onClick={() => setShowRatingModal(true)}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    userRating
                      ? "bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30"
                      : "bg-white/10 text-gray-300 hover:bg-white/20 hover:text-white"
                  }`}
                  aria-label="Rate episode"
                >
                  <HugeiconsIcon
                    icon={StarIcon}
                    className={`size-4 ${userRating ? "fill-yellow-500" : ""}`}
                  />
                  {userRating ? `${userRating.rating}/10` : "Rate"}
                </button>
              </div>
            )}
          </div>
        </div>
      </article>

      {/* Rating Modal */}
      <EpisodeRatingModal
        isOpen={showRatingModal}
        onClose={() => setShowRatingModal(false)}
        episode={episode}
        tvShowId={tvShowId}
        tvShowName={tvShowName}
      />
    </>
  )
}
