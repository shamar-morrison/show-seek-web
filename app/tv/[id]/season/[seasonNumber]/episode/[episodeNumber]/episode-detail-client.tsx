"use client"

import { CastRow } from "@/components/cast-row"
import { EpisodeRatingModal } from "@/components/episode-rating-modal"
import { AuthModal } from "@/components/auth-modal"
import { NotesModal } from "@/components/notes-modal"
import { PhotoLightbox } from "@/components/photo-lightbox"
import { SeasonEpisodesRail } from "./season-episodes-rail"
import { RateButton } from "@/components/rate-button"
import { TrailerModal } from "@/components/trailer-modal"
import { Button } from "@/components/ui/button"
import { Section } from "@/components/ui/section"
import { useAuth } from "@/context/auth-context"
import { useAuthGuard } from "@/hooks/use-auth-guard"
import { useEpisodeActions } from "@/hooks/use-episode-actions"
import { useEpisodeTrackingMutations } from "@/hooks/use-episode-tracking-mutations"
import { useEpisodeTrackingShow } from "@/hooks/use-episode-tracking-show"
import {
  useIsEpisodeFavorited,
  useToggleFavoriteEpisode,
} from "@/hooks/use-favorite-episodes"
import { useNotes } from "@/hooks/use-notes"
import { usePosterOverrides } from "@/hooks/use-poster-overrides"
import { usePreferences } from "@/hooks/use-preferences"
import { useRatings } from "@/hooks/use-ratings"
import { computeNextEpisode } from "@/lib/episode-utils"
import { formatDateLong, formatRuntime } from "@/lib/format-helpers"
import { getDisplayMediaTitle } from "@/lib/media-title"
import { buildImageUrl } from "@/lib/tmdb"
import { isTmdbDateOnOrBeforeToday } from "@/lib/tmdb-date"
import type {
  CastMember,
  TMDBEpisodeDetails,
  TMDBSeasonDetails,
  TMDBTVDetails,
} from "@/types/tmdb"
import {
  ArrowLeft02Icon,
  Calendar03Icon,
  CheckmarkCircle02Icon,
  FavouriteIcon,
  Loading03Icon,
  Note01Icon,
  NoteDoneIcon,
  PlayIcon,
  StarIcon,
  Tick02Icon,
  Time01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import Link from "next/link"
import { useCallback, useMemo, useState } from "react"

interface EpisodeDetailClientProps {
  tvShow: TMDBTVDetails
  season: TMDBSeasonDetails
  episode: TMDBEpisodeDetails
  tvShowId: number
}

/**
 * EpisodeDetailClient Component
 * Displays episode info, cast, crew, media, and action buttons
 */
export function EpisodeDetailClient({
  tvShow,
  season,
  episode,
  tvShowId,
}: EpisodeDetailClientProps) {
  const { user } = useAuth()
  const { getEpisodeRating } = useRatings()
  const { getNote, loading: notesLoading } = useNotes()
  const { resolvePosterPath } = usePosterOverrides()
  const { preferences } = usePreferences()
  const { tracking } = useEpisodeTrackingShow(tvShowId, !!user)
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
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [videoModalOpen, setVideoModalOpen] = useState(false)
  const displayShowTitle =
    getDisplayMediaTitle(tvShow, preferences.showOriginalTitles) || tvShow.name

  // Compute whether episode has aired
  const hasAired = isTmdbDateOnOrBeforeToday(episode.air_date)

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

  const isWatched = useMemo(() => {
    const key = `${episode.season_number}_${episode.episode_number}`
    return !!tracking?.episodes && key in tracking.episodes
  }, [tracking, episode.season_number, episode.episode_number])
  const watchedEpisodes = useMemo(() => {
    if (!tracking?.episodes) return {}

    return Object.keys(tracking.episodes).reduce<Record<string, boolean>>(
      (episodeMap, key) => {
        episodeMap[key] = true
        return episodeMap
      },
      {},
    )
  }, [tracking])
  const { favoriteActionLoading, handleFavoriteClick, openNotesModal } =
    useEpisodeActions({
      episode,
      favoriteActionLoading: favoriteStatusLoading || favoriteMutationPending,
      isFavorited,
      openNotes: () => setShowNotesModal(true),
      requireAuth,
      toggleEpisode,
      tvShowId,
      tvShowName: tvShow.name,
      tvShowPosterPath: tvShow.poster_path,
    })
  const notesMedia = useMemo(
    () => ({
      id: tvShowId,
      show_id: tvShowId,
      season_number: episode.season_number,
      episode_number: episode.episode_number,
      poster_path: tvShow.poster_path,
      title: episode.name,
    }),
    [
      episode.episode_number,
      episode.name,
      episode.season_number,
      tvShow.poster_path,
      tvShowId,
    ],
  )

  // Compute next episode when marking this one as watched
  const getNextEpisode = useCallback(
    () => computeNextEpisode(episode, season.episodes, tvShow.seasons),
    [season.episodes, episode, tvShow.seasons],
  )

  // Toggle watched status
  const handleToggleWatched = useCallback(async () => {
    if (!user || !hasAired || isToggling) return

    setIsToggling(true)
    try {
      if (isWatched) {
        await markEpisodeUnwatched({
          tvShowId,
          seasonNumber: episode.season_number,
          episodeNumber: episode.episode_number,
        })
      } else {
        // Compute next episode when marking as watched
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
            tvShowName: tvShow.name,
            posterPath: tvShow.poster_path,
          },
          showStats: {
            totalEpisodes: tvShow.number_of_episodes,
            avgRuntime: tvShow.episode_run_time?.[0] || 45,
          },
          nextEpisode,
          markPreviousEpisodesWatched: preferences.markPreviousEpisodesWatched,
          seasonEpisodes: season.episodes,
        })
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
    markEpisodeWatched,
    markEpisodeUnwatched,
    tvShowId,
    episode,
    season.episodes,
    tvShow,
    getNextEpisode,
    preferences.markPreviousEpisodesWatched,
  ])

  // Build image URLs
  const stillUrl = buildImageUrl(episode.still_path, "w1280")
  const posterUrl = buildImageUrl(
    resolvePosterPath("tv", tvShowId, tvShow.poster_path),
    "w185",
  )

  // Convert guest stars to CastMember format for CastRow
  const guestStarsAsCast: CastMember[] = episode.guest_stars.map((gs) => ({
    id: gs.id,
    name: gs.name,
    character: gs.character,
    profile_path: gs.profile_path,
    order: gs.order,
  }))

  // Convert key crew to CastMember format (Director, Writer roles)
  const crewAsCast: CastMember[] = episode.crew
    .filter((c) =>
      [
        "Director",
        "Writer",
        "Teleplay",
        "Story",
        "Director of Photography",
      ].includes(c.job),
    )
    .map((c) => ({
      id: c.id,
      name: c.name,
      character: c.job, // Use job as "character"
      profile_path: c.profile_path,
      order: 0,
    }))

  // Get first video (trailer/featurette)
  const video = episode.videos?.results?.[0]

  // Get stills for photos section
  const stills = episode.images?.stills || []

  return (
    <div>
      {/* Hero Section - matching media-detail-hero styling */}
      <section className="relative w-full overflow-hidden">
        {/* Background Backdrop Image */}
        {stillUrl && (
          <div className="absolute inset-0">
            <img
              src={stillUrl}
              alt={episode.name}
              className="absolute inset-0 h-full w-full object-cover object-center"
              sizes="100vw"
            />
          </div>
        )}

        {/* Gradient Overlays - matching media-detail-hero */}
        <div className="absolute inset-x-0 top-0 z-10 h-32 bg-linear-to-b from-black/70 to-transparent" />
        <div className="absolute inset-0 z-10 bg-linear-to-t from-black via-black/60 to-transparent" />
        <div className="absolute inset-0 z-10 bg-linear-to-r from-black/80 via-black/30 to-transparent" />

        {/* Content */}
        <div className="relative z-20 pb-16 pt-40">
          <div className="mx-auto w-full max-w-[1800px] px-4 sm:px-8 lg:px-12">
            {/* Back Link */}
            <Link
              href={`/tv/${tvShowId}/season/${episode.season_number}`}
              className="mb-6 inline-flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-white"
            >
              <HugeiconsIcon icon={ArrowLeft02Icon} className="size-4" />
              Back to {season.name}
            </Link>

            <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:gap-12">
              {/* Poster - same size as media-detail-hero */}
              <div className="mx-auto shrink-0 lg:mx-0">
                {posterUrl ? (
                  <Link href={`/tv/${tvShowId}`}>
                    <div className="relative aspect-2/3 w-48 overflow-hidden rounded-xl shadow-2xl sm:w-56 lg:w-64">
                      <img
                        src={posterUrl}
                        alt={tvShow.name}
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                        sizes="(max-width: 1024px) 224px, 256px"
                      />
                    </div>
                  </Link>
                ) : (
                  <div className="flex aspect-2/3 w-48 items-center justify-center rounded-xl bg-gray-800 text-gray-500 sm:w-56 lg:w-64">
                    No Poster
                  </div>
                )}
              </div>

              {/* Info Content */}
              <div className="flex flex-1 flex-col gap-4 text-center lg:text-left">
                {/* Episode Label */}
                <div className="text-sm font-medium text-primary">
                  Season {episode.season_number} · Episode{" "}
                  {episode.episode_number}
                </div>

                {/* Title - same size as media-detail-hero */}
                <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
                  {episode.name}
                </h1>

                {/* Stats Row - matching media-detail-hero */}
                <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-gray-300 lg:justify-start">
                  {/* Rating */}
                  {episode.vote_average > 0 && (
                    <span className="flex items-center gap-1 font-medium text-yellow-500">
                      <HugeiconsIcon
                        icon={StarIcon}
                        className="size-3 fill-yellow-500"
                      />
                      <span className="text-gray-300">
                        {episode.vote_average.toFixed(1)} / 10
                      </span>
                    </span>
                  )}
                  {/* Air Date */}
                  {episode.air_date && (
                    <span className="flex items-center gap-1">
                      <HugeiconsIcon
                        icon={Calendar03Icon}
                        className="size-4 text-gray-500"
                      />
                      {formatDateLong(episode.air_date)}
                    </span>
                  )}
                  {/* Runtime */}
                  {episode.runtime && (
                    <span className="flex items-center gap-1">
                      <HugeiconsIcon
                        icon={Time01Icon}
                        className="size-4 text-gray-500"
                      />
                      {formatRuntime(episode.runtime)}
                    </span>
                  )}
                </div>

                {/* TV Show Link */}
                <div className="text-sm text-gray-400">
                  TV Show:{" "}
                  <Link
                    href={`/tv/${tvShowId}`}
                    className="font-medium text-white hover:text-primary transition-colors"
                  >
                    {displayShowTitle}
                  </Link>
                </div>

                {/* Overview */}
                {episode.overview && (
                  <p
                    className={`max-w-3xl text-base leading-relaxed text-gray-300 lg:text-left text-center ${
                      preferences.blurPlotSpoilers
                        ? "blur-md transition-all duration-300 hover:blur-none"
                        : ""
                    }`}
                  >
                    {episode.overview}
                  </p>
                )}

                {/* Action Buttons - matching media-detail-hero style */}
                <div className="flex flex-wrap items-center justify-center gap-3 pt-4 lg:justify-start">
                  {hasAired && (
                    <>
                      {/* Watched Toggle */}
                      <Button
                        size="lg"
                        variant="outline"
                        onClick={() =>
                          requireAuth(
                            handleToggleWatched,
                            "Sign in to track your watch progress",
                          )
                        }
                        disabled={isToggling}
                        className={
                          isWatched
                            ? "border-green-500/50 bg-green-500/20 px-6 font-semibold text-green-400 backdrop-blur-sm transition-all hover:border-green-500 hover:bg-green-500/30"
                            : "border-white/20 bg-white/5 px-6 font-semibold text-white backdrop-blur-sm transition-all hover:border-white/40 hover:bg-white/10"
                        }
                      >
                        {isToggling ? (
                          <HugeiconsIcon
                            icon={Loading03Icon}
                            className="size-5 animate-spin"
                          />
                        ) : (
                          <HugeiconsIcon
                            icon={
                              isWatched ? Tick02Icon : CheckmarkCircle02Icon
                            }
                            className={`size-5 ${isWatched ? " text-green-400" : ""}`}
                          />
                        )}
                        {isWatched ? "Watched" : "Mark Watched"}
                      </Button>

                      {/* Rate Button */}
                      <RateButton
                        hasRating={!!userRating}
                        rating={userRating?.rating}
                        onClick={() =>
                          requireAuth(
                            () => setShowRatingModal(true),
                            "Sign in to rate episodes",
                          )
                        }
                        disabled={isToggling}
                      />
                    </>
                  )}

                  <Button
                    size="lg"
                    variant="outline"
                    onClick={handleFavoriteClick}
                    disabled={favoriteActionLoading}
                    className={
                      isFavorited
                        ? "border-red-500/50 bg-red-500/20 px-6 font-semibold text-red-400 backdrop-blur-sm transition-all hover:border-red-500 hover:bg-red-500/30"
                        : "border-white/20 bg-white/5 px-6 font-semibold text-white backdrop-blur-sm transition-all hover:border-white/40 hover:bg-white/10"
                    }
                  >
                    {favoriteActionLoading ? (
                      <HugeiconsIcon
                        icon={Loading03Icon}
                        className="size-5 animate-spin"
                      />
                    ) : (
                      <HugeiconsIcon
                        icon={FavouriteIcon}
                        className={`size-5 ${
                          isFavorited ? "fill-red-400 text-red-400" : ""
                        }`}
                      />
                    )}
                    {favoriteActionLoading
                      ? "Loading..."
                      : isFavorited
                        ? "Favorited"
                        : "Favorite"}
                  </Button>

                  <Button
                    size="lg"
                    variant="outline"
                    onClick={openNotesModal}
                    disabled={notesLoading}
                    className="border-white/20 bg-white/5 px-6 font-semibold text-white backdrop-blur-sm transition-all hover:border-white/40 hover:bg-white/10"
                  >
                    {notesLoading ? (
                      <HugeiconsIcon
                        icon={Loading03Icon}
                        className="size-5 animate-spin"
                      />
                    ) : (
                      <HugeiconsIcon
                        icon={userNote ? NoteDoneIcon : Note01Icon}
                        className={`size-5 ${userNote ? "text-primary" : ""}`}
                      />
                    )}
                    {notesLoading
                      ? "Loading..."
                      : userNote
                        ? "View Note"
                        : "Notes"}
                  </Button>

                  {!hasAired && (
                    <div className="rounded-full bg-primary/20 px-6 py-2.5 text-sm font-semibold text-primary backdrop-blur-sm">
                      {episode.air_date
                        ? `Coming ${formatDateLong(episode.air_date)}`
                        : "TBA"}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* Content sections with black background */}
      <div className="bg-black">
        {/* Guest Stars */}
        {guestStarsAsCast.length > 0 && (
          <CastRow
            title="Guest Stars"
            cast={guestStarsAsCast}
            href={`/tv/${tvShowId}/season/${episode.season_number}`}
          />
        )}

        {/* Crew */}
        {crewAsCast.length > 0 && (
          <CastRow
            title="Crew"
            cast={crewAsCast}
            href={`/tv/${tvShowId}/season/${episode.season_number}`}
          />
        )}

        {/* Videos */}
        {video && (
          <Section title="Videos">
            <button
              onClick={() => setVideoModalOpen(true)}
              className="group relative max-w-md overflow-hidden rounded-lg"
            >
              {/* YouTube Thumbnail */}
              <img
                src={`https://img.youtube.com/vi/${video.key}/mqdefault.jpg`}
                alt={video.name}
                className="w-full object-cover"
              />
              {/* Play Overlay */}
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 transition-colors group-hover:bg-black/50">
                <div className="rounded-full bg-white/90 p-4 transition-transform group-hover:scale-110">
                  <HugeiconsIcon
                    icon={PlayIcon}
                    className="size-8 text-black"
                  />
                </div>
              </div>
            </button>
            <p className="mt-2 text-sm text-gray-400">{video.name}</p>
          </Section>
        )}

        {/* Photos */}
        {stills.length > 0 && (
          <Section title="Photos">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {stills.slice(0, 10).map((still, index) => {
                const imgUrl = buildImageUrl(still.file_path, "w400")
                if (!imgUrl) return null

                return (
                  <button
                    key={still.file_path}
                    onClick={() => {
                      setLightboxIndex(index)
                      setLightboxOpen(true)
                    }}
                    className="relative aspect-video overflow-hidden rounded-lg transition-transform hover:scale-105"
                  >
                    <img
                      src={imgUrl}
                      alt={`Still ${index + 1}`}
                      className="absolute inset-0 h-full w-full object-cover"
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                    />
                  </button>
                )
              })}
            </div>
          </Section>
        )}

        <SeasonEpisodesRail
          tvShowId={tvShowId}
          seasonNumber={episode.season_number}
          episodes={season.episodes}
          currentEpisodeNumber={episode.episode_number}
          watchedEpisodes={watchedEpisodes}
        />
      </div>

      {/* Lightbox */}
      <PhotoLightbox
        images={stills}
        currentIndex={lightboxIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        onNavigate={setLightboxIndex}
      />

      {/* Rating Modal */}
      <EpisodeRatingModal
        isOpen={showRatingModal}
        onClose={() => setShowRatingModal(false)}
        episode={episode}
        tvShowId={tvShowId}
        tvShowName={tvShow.name}
        displayTvShowName={displayShowTitle}
      />

      <NotesModal
        isOpen={showNotesModal}
        onClose={() => setShowNotesModal(false)}
        media={notesMedia}
        mediaType="episode"
      />

      {/* Video Modal */}
      <TrailerModal
        videoKey={video?.key || null}
        isOpen={videoModalOpen}
        onClose={() => setVideoModalOpen(false)}
        title={video?.name || "Video"}
      />

      {/* Auth Modal for unauthenticated users */}
      <AuthModal
        isOpen={modalVisible}
        onClose={closeModal}
        message={modalMessage}
      />
    </div>
  )
}
