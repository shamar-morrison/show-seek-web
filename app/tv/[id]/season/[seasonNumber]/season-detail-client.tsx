"use client"

import { EpisodeCard } from "@/components/episode-card"
import { PageContainer } from "@/components/page-container"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useAuth } from "@/context/auth-context"
import { usePreferences } from "@/hooks/use-preferences"
import { formatDateLong } from "@/lib/format-helpers"
import { episodeTrackingService } from "@/services/episode-tracking-service"
import type { TMDBSeasonDetails, TMDBTVDetails } from "@/types/tmdb"
import {
  ArrowLeft02Icon,
  ArrowRight02Icon,
  Calendar03Icon,
  CheckmarkCircle02Icon,
  Loading03Icon,
  PlayCircle02Icon,
  StarIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

interface SeasonDetailClientProps {
  tvShow: TMDBTVDetails
  season: TMDBSeasonDetails
  tvShowId: number
}

/**
 * SeasonDetailClient Component
 * Displays season info, episode list with watch tracking functionality
 */
export function SeasonDetailClient({
  tvShow,
  season,
  tvShowId,
}: SeasonDetailClientProps) {
  const { user } = useAuth()
  const { preferences } = usePreferences()
  const [watchedEpisodes, setWatchedEpisodes] = useState<Set<string>>(new Set())
  const [isMarkingAll, setIsMarkingAll] = useState(false)
  const [isUnmarking, setIsUnmarking] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [posterFailed, setPosterFailed] = useState(false)

  // Get aired episodes only (exclude future episodes)
  const today = new Date()
  const airedEpisodes = season.episodes.filter(
    (ep) => ep.air_date && new Date(ep.air_date) <= today,
  )

  // Subscribe to episode tracking for this show
  useEffect(() => {
    if (!user) return

    const unsubscribe = episodeTrackingService.subscribeToShowTracking(
      tvShowId,
      (tracking) => {
        if (tracking?.episodes) {
          const watched = new Set(Object.keys(tracking.episodes))
          setWatchedEpisodes(watched)
        } else {
          setWatchedEpisodes(new Set())
        }
      },
    )

    return () => unsubscribe()
  }, [user, tvShowId])

  // Check if an episode is watched
  const isEpisodeWatched = useCallback(
    (seasonNumber: number, episodeNumber: number): boolean => {
      const key = `${seasonNumber}_${episodeNumber}`
      return watchedEpisodes.has(key)
    },
    [watchedEpisodes],
  )

  // Count watched episodes in this season
  const watchedCount = airedEpisodes.filter((ep) =>
    isEpisodeWatched(season.season_number, ep.episode_number),
  ).length

  // Calculate show stats for caching
  const showStats = {
    totalEpisodes: tvShow.number_of_episodes,
    avgRuntime: tvShow.episode_run_time?.[0] || 45,
  }

  // Mark all episodes as watched
  const handleMarkAllWatched = useCallback(async () => {
    if (!user) return

    setIsMarkingAll(true)
    setShowConfirmDialog(false)

    try {
      // Filter to only aired episodes
      const episodesToMark = airedEpisodes.map((ep) => ({
        id: ep.id,
        episode_number: ep.episode_number,
        name: ep.name,
        air_date: ep.air_date,
      }))

      // Compute next episode: find the next season and get its first episode
      let nextEpisode: {
        season: number
        episode: number
        title: string
        airDate: string | null
      } | null = null

      // Find the next season after the current one (excluding season 0 - specials)
      const nextSeasons = tvShow.seasons
        ?.filter(
          (s) => s.season_number > season.season_number && s.season_number > 0,
        )
        .sort((a, b) => a.season_number - b.season_number)

      if (nextSeasons && nextSeasons.length > 0) {
        const nextSeason = nextSeasons[0]
        // The first episode of the next season is the next episode
        nextEpisode = {
          season: nextSeason.season_number,
          episode: 1,
          title: `${nextSeason.name} Episode 1`,
          airDate: nextSeason.air_date || null,
        }
      }
      // If no next season, nextEpisode stays null (user is caught up!)

      await episodeTrackingService.markAllEpisodesWatched(
        tvShowId,
        season.season_number,
        episodesToMark,
        {
          tvShowName: tvShow.name,
          posterPath: tvShow.poster_path,
        },
        showStats,
        nextEpisode,
      )
    } catch (error) {
      console.error("Failed to mark all episodes watched:", error)
    } finally {
      setIsMarkingAll(false)
    }
  }, [user, airedEpisodes, tvShowId, season.season_number, tvShow, showStats])

  // Unmark all episodes in this season
  const handleUnmarkAllWatched = useCallback(async () => {
    if (!user) return

    setIsMarkingAll(true)
    setIsUnmarking(true)
    setShowConfirmDialog(false)

    try {
      // Unmark all aired episodes in parallel
      await Promise.all(
        airedEpisodes.map((ep) =>
          episodeTrackingService.markEpisodeUnwatched(
            tvShowId,
            season.season_number,
            ep.episode_number,
          ),
        ),
      )
    } catch (error) {
      console.error("Failed to unmark all episodes:", error)
      toast.error("Failed to unmark all episodes. Please try again.")
    } finally {
      setIsMarkingAll(false)
      setIsUnmarking(false)
    }
  }, [user, airedEpisodes, tvShowId, season.season_number])

  const posterUrl = season.poster_path
    ? `https://image.tmdb.org/t/p/w500${season.poster_path}`
    : tvShow.poster_path
      ? `https://image.tmdb.org/t/p/w500${tvShow.poster_path}`
      : null

  const allWatched =
    airedEpisodes.length > 0 && watchedCount === airedEpisodes.length

  return (
    <div className="pb-16 pt-32">
      {/* Hero Section */}
      <PageContainer className="mb-8">
        {/* Back Button */}
        <Link
          href={`/tv/${tvShowId}`}
          className="mb-6 inline-flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-white"
        >
          <HugeiconsIcon icon={ArrowLeft02Icon} className="size-4" />
          Back to {tvShow.name}
        </Link>

        <div className="flex flex-col gap-8 md:flex-row">
          {/* Season Poster */}
          <div className="shrink-0">
            {posterUrl && !posterFailed ? (
              <img
                src={posterUrl}
                alt={season.name}
                className="w-48 rounded-xl shadow-2xl md:w-64"
                onError={() => setPosterFailed(true)}
              />
            ) : (
              <div className="flex aspect-2/3 w-48 items-center justify-center rounded-xl bg-gray-800 text-gray-500 shadow-2xl md:w-64">
                No Poster
              </div>
            )}
          </div>

          {/* Season Info */}
          <div className="flex flex-col justify-end">
            <p className="mb-2 text-sm font-medium uppercase tracking-wider text-primary">
              {tvShow.name}
            </p>
            <h1 className="mb-4 text-3xl font-bold text-white md:text-4xl">
              {season.name}
            </h1>

            {/* Metadata */}
            <div className="mb-4 flex flex-wrap items-center gap-4 text-sm text-gray-400">
              {season.air_date && (
                <div className="flex items-center gap-1.5">
                  <HugeiconsIcon icon={Calendar03Icon} className="size-4" />
                  <span>{formatDateLong(season.air_date)}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <HugeiconsIcon icon={PlayCircle02Icon} className="size-4" />
                <span>{season.episodes.length} Episodes</span>
              </div>
              {season.vote_average > 0 && (
                <div className="flex items-center gap-1.5">
                  <HugeiconsIcon
                    icon={StarIcon}
                    className="size-4 fill-yellow-500 text-yellow-500"
                  />
                  <span>{season.vote_average.toFixed(1)}</span>
                </div>
              )}
            </div>

            {/* Overview */}
            {season.overview && (
              <p
                className={`mb-6 max-w-2xl text-gray-300 line-clamp-3 ${
                  preferences.blurPlotSpoilers
                    ? "blur-md transition-all duration-300 hover:blur-none"
                    : ""
                }`}
              >
                {season.overview}
              </p>
            )}

            {/* Progress & Actions */}
            <div className="flex flex-wrap items-center gap-4">
              {user && airedEpisodes.length > 0 && (
                <>
                  {/* Progress Badge */}
                  <div className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2">
                    <HugeiconsIcon
                      icon={CheckmarkCircle02Icon}
                      className={`size-5 ${allWatched ? "text-green-500" : "text-gray-400"}`}
                    />
                    <span className="text-sm font-medium text-white">
                      {watchedCount} / {airedEpisodes.length} watched
                    </span>
                  </div>

                  {/* Mark/Unmark All Button */}
                  <Button
                    onClick={() => setShowConfirmDialog(true)}
                    disabled={isMarkingAll}
                    variant={allWatched ? "outline" : "secondary"}
                  >
                    {isMarkingAll ? (
                      <>
                        <HugeiconsIcon
                          icon={Loading03Icon}
                          className="mr-2 size-4 animate-spin"
                        />
                        {isUnmarking ? "Unmarking..." : "Marking..."}
                      </>
                    ) : (
                      <>
                        <HugeiconsIcon
                          icon={CheckmarkCircle02Icon}
                          className="size-4"
                        />
                        {allWatched ? "Unmark All" : "Mark All Watched"}
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </PageContainer>

      {/* Episode List */}
      <PageContainer>
        <h2 className="mb-6 text-xl font-bold text-white">Episodes</h2>

        <div className="grid gap-4">
          {season.episodes.map((episode) => (
            <EpisodeCard
              key={episode.id}
              episode={episode}
              tvShowId={tvShowId}
              tvShowName={tvShow.name}
              tvShowPosterPath={tvShow.poster_path}
              isWatched={isEpisodeWatched(
                season.season_number,
                episode.episode_number,
              )}
              showStats={showStats}
              allSeasonEpisodes={season.episodes}
              tvShowSeasons={tvShow.seasons}
              tvShowVoteAverage={tvShow.vote_average}
              tvShowFirstAirDate={tvShow.first_air_date}
            />
          ))}
        </div>

        {season.episodes.length === 0 && (
          <div className="py-12 text-center text-gray-400">
            No episodes available for this season yet.
          </div>
        )}

        {/* Season Pagination */}
        {(() => {
          // Get valid seasons (excluding specials), sorted by number
          const validSeasons =
            tvShow.seasons
              ?.filter((s) => s.season_number > 0)
              .sort((a, b) => a.season_number - b.season_number) ?? []

          // Find the closest previous season
          const prevSeasons = validSeasons
            .filter((s) => s.season_number < season.season_number)
            .sort((a, b) => b.season_number - a.season_number)
          const closestPrev = prevSeasons[0]

          const nextSeasons = validSeasons
            .filter((s) => s.season_number > season.season_number)
            .sort((a, b) => a.season_number - b.season_number)
          const nextSeason = nextSeasons[0]

          if (!closestPrev && !nextSeason) return null

          return (
            <div className="mt-8 flex items-center justify-between gap-4">
              {/* Previous Season */}
              {closestPrev ? (
                <Link
                  href={`/tv/${tvShowId}/season/${closestPrev.season_number}`}
                  className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-white/20"
                >
                  <HugeiconsIcon icon={ArrowLeft02Icon} className="size-4" />
                  {closestPrev.name}
                </Link>
              ) : (
                <div />
              )}

              {/* Next Season */}
              {nextSeason ? (
                <Link
                  href={`/tv/${tvShowId}/season/${nextSeason.season_number}`}
                  className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-white/20"
                >
                  {nextSeason.name}
                  <HugeiconsIcon icon={ArrowRight02Icon} className="size-4" />
                </Link>
              ) : (
                <div />
              )}
            </div>
          )
        })()}
      </PageContainer>

      {/* Confirm Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {allWatched
                ? "Unmark All Episodes?"
                : "Mark All Episodes Watched?"}
            </DialogTitle>
            <DialogDescription>
              {allWatched
                ? `This will unmark all ${airedEpisodes.length} episodes in ${season.name} as unwatched.`
                : `This will mark all ${airedEpisodes.length} aired episodes in ${season.name} as watched.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={
                allWatched ? handleUnmarkAllWatched : handleMarkAllWatched
              }
            >
              {allWatched ? "Unmark All" : "Mark All Watched"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
