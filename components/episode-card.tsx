"use client"

import { EpisodeRatingModal } from "@/components/episode-rating-modal"
import { AuthModal } from "@/components/auth-modal"
import { useAuth } from "@/context/auth-context"
import { useAuthGuard } from "@/hooks/use-auth-guard"
import { usePreferences } from "@/hooks/use-preferences"
import { useRatings } from "@/hooks/use-ratings"
import { computeNextEpisode } from "@/lib/episode-utils"
import { addToList } from "@/lib/firebase/lists"
import { formatDateShort, formatRuntime } from "@/lib/format-helpers"
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
import { toast } from "sonner"

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
  /** TV show vote average for list feature */
  tvShowVoteAverage?: number
  /** TV show first air date for list feature */
  tvShowFirstAirDate?: string
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
  tvShowVoteAverage,
  tvShowFirstAirDate,
}: EpisodeCardProps) {
  const { user } = useAuth()
  const { getEpisodeRating } = useRatings()
  const { preferences } = usePreferences()
  const { requireAuth, modalVisible, modalMessage, closeModal } = useAuthGuard()
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

  // Compute next episode when marking this one as watched
  const getNextEpisode = useCallback(
    () => computeNextEpisode(episode, allSeasonEpisodes, tvShowSeasons),
    [allSeasonEpisodes, episode, tvShowSeasons],
  )

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
        const nextEpisode = getNextEpisode()

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
          preferences.markPreviousEpisodesWatched,
          allSeasonEpisodes,
        )

        // Auto-add to "Watching" list if preference is enabled
        if (preferences.autoAddToWatching) {
          try {
            const wasAdded = await addToList(user.uid, "currently-watching", {
              id: tvShowId,
              title: tvShowName,
              poster_path: tvShowPosterPath,
              media_type: "tv",
              vote_average: tvShowVoteAverage,
              first_air_date: tvShowFirstAirDate,
            })

            if (wasAdded) {
              toast.success("Added to Watching list")
            }
          } catch (listError) {
            console.error("Failed to auto-add to Watching list:", listError)
            // Don't fail the whole operation if list update fails
          }
        }
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
    getNextEpisode,
    allSeasonEpisodes,
    preferences.autoAddToWatching,
    preferences.markPreviousEpisodesWatched,
    tvShowVoteAverage,
    tvShowFirstAirDate,
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
                  {episode.air_date
                    ? `Coming ${formatDateShort(episode.air_date)}`
                    : "TBA"}
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
                  <span>{formatDateShort(episode.air_date)}</span>
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
            {hasAired && (
              <div className="mt-4 flex items-center gap-3">
                {/* Watched Toggle */}
                <button
                  onClick={() =>
                    requireAuth(
                      handleToggleWatched,
                      "Sign in to track your watch progress",
                    )
                  }
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
                  onClick={() =>
                    requireAuth(
                      () => setShowRatingModal(true),
                      "Sign in to rate episodes",
                    )
                  }
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

      {/* Auth Modal for unauthenticated users */}
      <AuthModal
        isOpen={modalVisible}
        onClose={closeModal}
        message={modalMessage}
      />
    </>
  )
}
