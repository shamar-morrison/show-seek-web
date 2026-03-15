"use client"

import { EpisodeRatingModal } from "@/components/episode-rating-modal"
import { AuthModal } from "@/components/auth-modal"
import { NotesModal } from "@/components/notes-modal"
import { useAuth } from "@/context/auth-context"
import { useAuthGuard } from "@/hooks/use-auth-guard"
import { useEpisodeActions } from "@/hooks/use-episode-actions"
import { useEpisodeTrackingMutations } from "@/hooks/use-episode-tracking-mutations"
import {
  useIsEpisodeFavorited,
  useToggleFavoriteEpisode,
} from "@/hooks/use-favorite-episodes"
import { useListMutations } from "@/hooks/use-list-mutations"
import { useNotes } from "@/hooks/use-notes"
import { usePreferences } from "@/hooks/use-preferences"
import { useRatings } from "@/hooks/use-ratings"
import { computeNextEpisode } from "@/lib/episode-utils"
import { formatDateShort, formatRuntime } from "@/lib/format-helpers"
import type { TMDBSeason, TMDBSeasonEpisode } from "@/types/tmdb"
import {
  CheckmarkCircle02Icon,
  FavouriteIcon,
  Loading03Icon,
  Note01Icon,
  NoteDoneIcon,
  StarIcon,
  Time02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import Link from "next/link"
import { useCallback, useMemo, useState } from "react"
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
  const { getNote, loading: notesLoading } = useNotes()
  const { preferences } = usePreferences()
  const { addToList } = useListMutations()
  const { markEpisodeWatched, markEpisodeUnwatched } =
    useEpisodeTrackingMutations()
  const { isFavorited, loading: favoriteStatusLoading } = useIsEpisodeFavorited(
    tvShowId,
    episode.season_number,
    episode.episode_number,
  )
  const { toggleEpisode, isToggling: favoriteMutationPending } =
    useToggleFavoriteEpisode()
  const { requireAuth, modalVisible, modalMessage, closeModal } = useAuthGuard()
  const [isToggling, setIsToggling] = useState(false)
  const [showRatingModal, setShowRatingModal] = useState(false)
  const [showNotesModal, setShowNotesModal] = useState(false)

  // Check if episode has aired
  const today = new Date()
  const hasAired = episode.air_date && new Date(episode.air_date) <= today

  // Get user's rating for this episode
  const userRating = getEpisodeRating(
    tvShowId,
    episode.season_number,
    episode.episode_number,
  )
  const userNote = getNote(
    "episode",
    tvShowId,
    episode.season_number,
    episode.episode_number,
  )
  const { favoriteActionLoading, handleFavoriteClick, openNotesModal } =
    useEpisodeActions({
      episode,
      favoriteActionLoading: favoriteStatusLoading || favoriteMutationPending,
      isFavorited,
      openNotes: () => setShowNotesModal(true),
      requireAuth,
      toggleEpisode,
      tvShowId,
      tvShowName,
      tvShowPosterPath,
    })
  const notesMedia = useMemo(
    () => ({
      id: tvShowId,
      show_id: tvShowId,
      season_number: episode.season_number,
      episode_number: episode.episode_number,
      poster_path: tvShowPosterPath,
      title: episode.name,
    }),
    [
      tvShowId,
      tvShowPosterPath,
      episode.season_number,
      episode.episode_number,
      episode.name,
    ],
  )

  // Compute next episode when marking this one as watched
  const getNextEpisode = useCallback(
    () => computeNextEpisode(episode, allSeasonEpisodes, tvShowSeasons),
    [allSeasonEpisodes, episode, tvShowSeasons],
  )

  const handleMarkWatched = useCallback(async () => {
    const nextEpisode = getNextEpisode()

    await markEpisodeWatched({
      tvShowId,
      seasonNumber: episode.season_number,
      episodeNumber: episode.episode_number,
      episodeData: {
        episodeId: episode.id,
        episodeName: episode.name,
        episodeAirDate: episode.air_date,
      },
      showMetadata: {
        tvShowName,
        posterPath: tvShowPosterPath,
      },
      showStats,
      nextEpisode,
      markPreviousEpisodesWatched: preferences.markPreviousEpisodesWatched,
      seasonEpisodes: allSeasonEpisodes,
    })

    if (!preferences.autoAddToWatching) return

    try {
      const wasAdded = await addToList("currently-watching", {
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
  }, [
    getNextEpisode,
    markEpisodeWatched,
    tvShowId,
    episode,
    tvShowName,
    tvShowPosterPath,
    showStats,
    preferences.markPreviousEpisodesWatched,
    preferences.autoAddToWatching,
    allSeasonEpisodes,
    addToList,
    tvShowVoteAverage,
    tvShowFirstAirDate,
  ])

  const handleMarkUnwatched = useCallback(async () => {
    await markEpisodeUnwatched({
      tvShowId,
      seasonNumber: episode.season_number,
      episodeNumber: episode.episode_number,
    })
  }, [
    markEpisodeUnwatched,
    tvShowId,
    episode.season_number,
    episode.episode_number,
  ])

  // Toggle watched status
  const handleToggleWatched = useCallback(async () => {
    if (!user || !hasAired || isToggling) return

    setIsToggling(true)
    try {
      if (isWatched) {
        await handleMarkUnwatched()
      } else {
        await handleMarkWatched()
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
    handleMarkUnwatched,
    handleMarkWatched,
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
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {hasAired && (
                <>
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
                </>
              )}

              <button
                onClick={handleFavoriteClick}
                disabled={favoriteActionLoading}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isFavorited
                    ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                    : "bg-white/10 text-gray-300 hover:bg-white/20 hover:text-white"
                }`}
                aria-label={
                  isFavorited
                    ? "Remove episode from favorites"
                    : "Add episode to favorites"
                }
              >
                {favoriteActionLoading ? (
                  <HugeiconsIcon
                    icon={Loading03Icon}
                    className="size-4 animate-spin"
                  />
                ) : (
                  <HugeiconsIcon
                    icon={FavouriteIcon}
                    className={`size-4 ${isFavorited ? "fill-red-400 text-red-400" : ""}`}
                  />
                )}
                {favoriteActionLoading
                  ? "Loading..."
                  : isFavorited
                    ? "Favorited"
                    : "Favorite"}
              </button>

              <button
                onClick={openNotesModal}
                disabled={notesLoading}
                className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-70"
                aria-label={userNote ? "View episode note" : "Add episode note"}
              >
                {notesLoading ? (
                  <HugeiconsIcon
                    icon={Loading03Icon}
                    className="size-4 animate-spin"
                  />
                ) : (
                  <HugeiconsIcon
                    icon={userNote ? NoteDoneIcon : Note01Icon}
                    className={`size-4 ${userNote ? "text-primary" : ""}`}
                  />
                )}
                {notesLoading ? "Loading..." : userNote ? "View Note" : "Notes"}
              </button>
            </div>
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

      <NotesModal
        isOpen={showNotesModal}
        onClose={() => setShowNotesModal(false)}
        media={notesMedia}
        mediaType="episode"
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
