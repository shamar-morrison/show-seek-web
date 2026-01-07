"use client"

import { AddToListModal } from "@/components/add-to-list-modal"
import { AuthModal } from "@/components/auth-modal"
import { NotesModal } from "@/components/notes-modal"
import { RatingModal } from "@/components/rating-modal"
import { TrailerModal } from "@/components/trailer-modal"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { WatchTrailerButton } from "@/components/watch-trailer-button"
import { useAuthGuard } from "@/hooks/use-auth-guard"
import { useLists } from "@/hooks/use-lists"
import { useNotes } from "@/hooks/use-notes"
import { useRatings } from "@/hooks/use-ratings"
import { buildImageUrl } from "@/lib/tmdb"
import type { Genre, TMDBMovieDetails, TMDBTVDetails } from "@/types/tmdb"
import {
  CalendarIcon,
  CheckmarkCircle02Icon,
  Clock,
  InformationCircleIcon,
  Note01Icon,
  NoteDoneIcon,
  PlusSignIcon,
  StarIcon,
  Tick02Icon,
  Tv01FreeIcons,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import Image from "next/image"
import Link from "next/link"
import { useMemo, useState } from "react"

interface MediaDetailHeroProps {
  /** Movie or TV show details */
  media: TMDBMovieDetails | TMDBTVDetails
  /** Media type for display purposes */
  mediaType: "movie" | "tv"
  /** YouTube trailer key if available */
  trailerKey: string | null
}

/**
 * Helper to get creators/directors with IDs
 */
interface Creator {
  id: number
  name: string
}

/**
 * Extracts director from movie credits
 */
function getDirector(media: TMDBMovieDetails): Creator[] {
  const directors =
    media.credits?.crew.filter((c) => c.job === "Director") ?? []
  return directors.map((d) => ({ id: d.id, name: d.name }))
}

/**
 * Extracts creator(s) from TV show details
 */
function getCreator(media: TMDBTVDetails): Creator[] {
  if (media.created_by && media.created_by.length > 0) {
    return media.created_by.map((c) => ({ id: c.id, name: c.name }))
  }
  return []
}

/**
 * Formats runtime in hours and minutes
 */
function formatRuntime(minutes: number | null): string | null {
  if (!minutes) return null
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours === 0) return `${mins}m`
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}m`
}

/**
 * Gets episode runtime for TV shows
 */
function getTVRuntime(runtimes: number[]): string | null {
  if (!runtimes || runtimes.length === 0) return null
  const avgRuntime = Math.round(
    runtimes.reduce((a, b) => a + b, 0) / runtimes.length,
  )
  return `${avgRuntime}m per episode`
}

/**
 * Formats a date string to "Dec. 19, 2025" format
 */
function formatDate(dateString: string | null | undefined): string | null {
  if (!dateString) return null
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return null
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

/**
 * MediaDetailHero Component
 * Cinematic hero section for movie/TV detail pages with backdrop,
 * poster, metadata, and action buttons
 */
export function MediaDetailHero({
  media,
  mediaType,
  trailerKey,
}: MediaDetailHeroProps) {
  const [isTrailerOpen, setIsTrailerOpen] = useState(false)
  const [isAddToListOpen, setIsAddToListOpen] = useState(false)
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false)
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false)
  const { lists } = useLists()
  const { getRating } = useRatings()
  const { getNote } = useNotes()
  const { requireAuth, modalVisible, modalMessage, closeModal } = useAuthGuard()

  // Get user's rating for this media
  const userRating = useMemo(() => {
    return getRating(mediaType, media.id)
  }, [getRating, mediaType, media.id])

  // Get user's note for this media
  const userNote = useMemo(() => {
    return getNote(mediaType, media.id)
  }, [getNote, mediaType, media.id])

  // Check if media is in any list
  const isInAnyList = useMemo(() => {
    const numericKey = String(media.id)
    return lists.some((list) => list.items && list.items[numericKey])
  }, [lists, media.id])

  // Extract common properties
  const title =
    mediaType === "movie"
      ? (media as TMDBMovieDetails).title
      : (media as TMDBTVDetails).name
  const overview = media.overview || "No description available."
  const backdropUrl = buildImageUrl(media.backdrop_path, "original")
  const posterUrl = buildImageUrl(media.poster_path, "w500")
  const rating = Math.round(media.vote_average * 10) / 10
  const genres = media.genres || []

  // Extract type-specific properties
  const releaseDate =
    mediaType === "movie"
      ? (media as TMDBMovieDetails).release_date
      : (media as TMDBTVDetails).first_air_date

  const runtime =
    mediaType === "movie"
      ? formatRuntime((media as TMDBMovieDetails).runtime)
      : getTVRuntime((media as TMDBTVDetails).episode_run_time)

  const creators =
    mediaType === "movie"
      ? getDirector(media as TMDBMovieDetails)
      : getCreator(media as TMDBTVDetails)

  const creatorLabel = mediaType === "movie" ? "Director" : "Creator"

  return (
    <>
      <section className="relative w-full overflow-hidden">
        {/* Background Backdrop Image */}
        {backdropUrl && (
          <div className="absolute inset-0">
            <Image
              src={backdropUrl}
              alt={title}
              fill
              priority
              className="object-cover object-center"
              sizes="100vw"
            />
          </div>
        )}

        {/* Gradient Overlays */}
        <div className="absolute inset-x-0 top-0 z-10 h-32 bg-linear-to-b from-black/70 to-transparent" />
        <div className="absolute inset-0 z-10 bg-linear-to-t from-black via-black/60 to-transparent" />
        <div className="absolute inset-0 z-10 bg-linear-to-r from-black/80 via-black/30 to-transparent" />

        {/* Content */}
        <div className="relative z-20 pb-16 pt-40">
          <div className="mx-auto w-full max-w-[1800px] px-4 sm:px-8 lg:px-12">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:gap-12">
              {/* Poster */}
              <div className="mx-auto shrink-0 lg:mx-0">
                {posterUrl ? (
                  <div className="relative aspect-2/3 w-48 overflow-hidden rounded-xl shadow-2xl sm:w-56 lg:w-64">
                    <Image
                      src={posterUrl}
                      alt={`${title} poster`}
                      fill
                      priority
                      className="object-cover"
                      sizes="(max-width: 1024px) 224px, 256px"
                    />
                  </div>
                ) : (
                  <div className="flex aspect-2/3 w-48 items-center justify-center rounded-xl bg-gray-800 text-gray-500 sm:w-56 lg:w-64">
                    No Poster
                  </div>
                )}
              </div>

              {/* Info Content */}
              <div className="flex flex-1 flex-col gap-4 text-center lg:text-left">
                {/* Title */}
                <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
                  {title}
                </h1>

                {/* Metadata Badges */}
                <div className="flex flex-wrap items-center justify-center gap-3 lg:justify-start">
                  {/* Genres */}
                  {genres.slice(0, 3).map((genre: Genre) => (
                    <Badge key={genre.id}>{genre.name}</Badge>
                  ))}
                </div>

                {/* Stats Row */}
                <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-gray-300 lg:justify-start">
                  {/* Rating */}
                  {rating > 0 && (
                    <span className="flex items-center gap-1 font-medium text-yellow-500">
                      <HugeiconsIcon
                        icon={StarIcon}
                        className="size-3 fill-yellow-500"
                      />
                      <span className="text-gray-300">{rating} / 10</span>
                    </span>
                  )}
                  {/* Release Date */}
                  {releaseDate && (
                    <span className="flex items-center gap-1">
                      <HugeiconsIcon
                        icon={CalendarIcon}
                        className="size-4 text-gray-500"
                      />
                      {formatDate(releaseDate)}
                    </span>
                  )}
                  {/* Runtime */}
                  {runtime && (
                    <span className="flex items-center gap-1">
                      <HugeiconsIcon
                        icon={Clock}
                        className="size-4 text-gray-500"
                      />
                      {runtime}
                    </span>
                  )}
                  {/* Episode Count (TV only) */}
                  {mediaType === "tv" &&
                    (media as TMDBTVDetails).number_of_episodes > 0 && (
                      <span className="flex items-center gap-1">
                        <HugeiconsIcon
                          icon={Tv01FreeIcons}
                          className="size-4 text-gray-500"
                        />
                        {(media as TMDBTVDetails).number_of_episodes} Eps
                      </span>
                    )}
                  {/* Status (TV only - when Ended or Canceled) */}
                  {mediaType === "tv" &&
                    ((media as TMDBTVDetails).status === "Ended" ||
                      (media as TMDBTVDetails).status === "Canceled") && (
                      <span className="flex items-center gap-1">
                        <HugeiconsIcon
                          icon={InformationCircleIcon}
                          className="size-4 text-gray-500"
                        />
                        {(media as TMDBTVDetails).status}
                      </span>
                    )}
                </div>

                {/* Director/Creator */}
                {creators.length > 0 && (
                  <div className="text-sm text-gray-400">
                    <span className="font-medium text-gray-300">
                      {creatorLabel}:{" "}
                    </span>
                    {creators.map((c, i) => (
                      <span key={c.id}>
                        {i > 0 && ", "}
                        <Link
                          href={`/person/${c.id}`}
                          className="hover:text-primary transition-colors"
                        >
                          {c.name}
                        </Link>
                      </span>
                    ))}
                  </div>
                )}

                {/* Overview */}
                <p className="max-w-3xl text-base leading-relaxed text-gray-300 lg:text-left text-center">
                  {overview}
                </p>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center justify-center gap-3 pt-4 lg:justify-start">
                  {/* Watch Trailer - Primary */}
                  <WatchTrailerButton
                    hasTrailer={!!trailerKey}
                    onClick={() => setIsTrailerOpen(true)}
                    label="Trailer"
                  />

                  {/* Add to List */}
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-white/20 bg-white/5 px-6 font-semibold text-white backdrop-blur-sm transition-all hover:border-white/40 hover:bg-white/10"
                    onClick={() => setIsAddToListOpen(true)}
                  >
                    <HugeiconsIcon
                      icon={isInAnyList ? Tick02Icon : PlusSignIcon}
                      className="size-5"
                    />
                    {isInAnyList ? "Added" : "Add"}
                  </Button>

                  {/* Mark as Watched - Secondary */}
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-white/20 bg-white/5 px-6 font-semibold text-white backdrop-blur-sm transition-all hover:border-white/40 hover:bg-white/10"
                  >
                    <HugeiconsIcon
                      icon={CheckmarkCircle02Icon}
                      className="size-5"
                    />
                    Mark as Watched
                  </Button>

                  {/* Rate - Secondary */}
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-white/20 bg-white/5 px-6 font-semibold text-white backdrop-blur-sm transition-all hover:border-white/40 hover:bg-white/10"
                    onClick={() =>
                      requireAuth(
                        () => setIsRatingModalOpen(true),
                        "Sign in to rate movies and TV shows",
                      )
                    }
                  >
                    <HugeiconsIcon
                      icon={StarIcon}
                      className={`size-5 ${userRating ? "fill-yellow-500 text-yellow-500" : ""}`}
                    />
                    {userRating ? `${userRating.rating}/10` : "Rate"}
                  </Button>

                  {/* Notes - Secondary */}
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-white/20 bg-white/5 px-6 font-semibold text-white backdrop-blur-sm transition-all hover:border-white/40 hover:bg-white/10"
                    onClick={() =>
                      requireAuth(
                        () => setIsNotesModalOpen(true),
                        "Sign in to add personal notes",
                      )
                    }
                  >
                    <HugeiconsIcon
                      icon={userNote ? NoteDoneIcon : Note01Icon}
                      className={`size-5 ${userNote ? "text-primary" : ""}`}
                    />
                    {userNote ? "View Note" : "Notes"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trailer Modal */}
      <TrailerModal
        videoKey={trailerKey}
        isOpen={isTrailerOpen}
        onClose={() => setIsTrailerOpen(false)}
        title={`${title} - Trailer`}
      />

      {/* Add to List Modal */}
      <AddToListModal
        isOpen={isAddToListOpen}
        onClose={() => setIsAddToListOpen(false)}
        media={media}
        mediaType={mediaType}
      />

      {/* Rating Modal */}
      <RatingModal
        isOpen={isRatingModalOpen}
        onClose={() => setIsRatingModalOpen(false)}
        media={media}
        mediaType={mediaType}
      />

      {/* Notes Modal */}
      <NotesModal
        isOpen={isNotesModalOpen}
        onClose={() => setIsNotesModalOpen(false)}
        media={media}
        mediaType={mediaType}
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
