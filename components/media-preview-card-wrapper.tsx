"use client"

import { AddToListModal } from "@/components/add-to-list-modal"
import { AuthModal } from "@/components/auth-modal"
import { MarkAsWatchedModal } from "@/components/mark-as-watched-modal"
import { MediaCard } from "@/components/media-card"
import type { DropdownMenuItem } from "@/components/media-card-dropdown-menu"
import {
  MediaPreviewContent,
  MediaPreviewSkeleton,
} from "@/components/media-preview-content"
import { NotesModal } from "@/components/notes-modal"
import { RatingModal } from "@/components/rating-modal"
import { useAuthGuard } from "@/hooks/use-auth-guard"
import { useMediaDetails } from "@/hooks/use-media-details"
import { usePreferences } from "@/hooks/use-preferences"
import { useWatchedMovies } from "@/hooks/use-watched-movies"
import type { TMDBMedia, TMDBMovieDetails, TMDBTVDetails } from "@/types/tmdb"
import { PreviewCard } from "@base-ui/react/preview-card"
import { useCallback, useState } from "react"

interface MediaPreviewCardWrapperProps {
  /** The media item */
  media: TMDBMedia
  /** Media type */
  mediaType: "movie" | "tv"
  /** Trailer click handler */
  onWatchTrailer?: (media: TMDBMedia) => void
  /** Loading state for trailer */
  isLoading?: boolean
  /** Priority image loading */
  priority?: boolean
  /** Button text for trailer button */
  buttonText?: string
  /** Dropdown menu items */
  dropdownItems?: DropdownMenuItem[]
  /** User's rating */
  userRating?: number | null
  /** List IDs for indicators */
  listIds?: string[]
}

/**
 * Wrapper component that adds hover preview card functionality to MediaCard.
 * Only renders on desktop via CSS media query.
 * Fetches detailed media data lazily when the preview opens.
 * Manages modal state to ensure modals persist after preview card closes.
 */
export function MediaPreviewCardWrapper({
  media,
  mediaType,
  onWatchTrailer,
  isLoading = false,
  priority = false,
  buttonText,
  dropdownItems,
  userRating,
  listIds,
}: MediaPreviewCardWrapperProps) {
  const [isOpen, setIsOpen] = useState(false)

  // Modal state - managed here so modals persist when preview card closes
  const [isAddToListOpen, setIsAddToListOpen] = useState(false)
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false)
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false)
  const [isMarkAsWatchedOpen, setIsMarkAsWatchedOpen] = useState(false)
  const [isQuickMarkLoading, setIsQuickMarkLoading] = useState(false)

  // Auth guard for protected actions
  const { requireAuth, modalVisible, modalMessage, closeModal } = useAuthGuard()

  // Preferences for quick mark
  const { preferences } = usePreferences()

  // Watch history for movies only
  const {
    count: watchCount,
    addWatchInstance,
    clearAllWatches,
  } = useWatchedMovies(mediaType === "movie" ? media.id : 0)

  // Only fetch when preview card is opened (lazy loading)
  const { data: detailedMedia, isLoading: isLoadingDetails } = useMediaDetails(
    mediaType,
    media.id,
    { enabled: isOpen },
  )

  const mediaCard = (
    <MediaCard
      media={media}
      onWatchTrailer={onWatchTrailer}
      isLoading={isLoading}
      priority={priority}
      buttonText={buttonText}
      dropdownItems={dropdownItems}
      userRating={userRating}
      listIds={listIds}
    />
  )

  // Handlers that close preview card then open modal
  const handleAddToList = () => {
    setIsOpen(false)
    requireAuth(() => setIsAddToListOpen(true), "Sign in to add to your lists")
  }

  const handleRate = () => {
    setIsOpen(false)
    requireAuth(
      () => setIsRatingModalOpen(true),
      "Sign in to rate movies and TV shows",
    )
  }

  const handleNotes = () => {
    setIsOpen(false)
    requireAuth(
      () => setIsNotesModalOpen(true),
      "Sign in to add personal notes",
    )
  }

  // Handle Mark as Watched button click
  // Respects Quick Mark preference - if enabled, immediately marks without modal
  const handleMarkAsWatched = useCallback(async () => {
    if (mediaType !== "movie" || !detailedMedia) return

    setIsOpen(false)

    const movieMedia = detailedMedia as TMDBMovieDetails

    if (preferences.quickMarkAsWatched) {
      // Quick mark - immediately mark as watched with current time
      setIsQuickMarkLoading(true)
      try {
        await addWatchInstance(
          new Date(),
          {
            title: movieMedia.title,
            posterPath: movieMedia.poster_path,
            voteAverage: movieMedia.vote_average,
            releaseDate: movieMedia.release_date,
            genreIds: movieMedia.genres?.map((g) => g.id),
          },
          preferences.autoAddToAlreadyWatched,
        )
      } catch (error) {
        console.error("Error quick marking as watched:", error)
      } finally {
        setIsQuickMarkLoading(false)
      }
    } else {
      // Open modal to select date
      requireAuth(
        () => setIsMarkAsWatchedOpen(true),
        "Sign in to mark movies as watched",
      )
    }
  }, [
    mediaType,
    detailedMedia,
    preferences.quickMarkAsWatched,
    preferences.autoAddToAlreadyWatched,
    addWatchInstance,
    requireAuth,
  ])

  // Handle mark as watched from modal
  const handleModalMarkAsWatched = useCallback(
    async (date: Date) => {
      if (mediaType !== "movie" || !detailedMedia) return
      const movieMedia = detailedMedia as TMDBMovieDetails
      await addWatchInstance(
        date,
        {
          title: movieMedia.title,
          posterPath: movieMedia.poster_path,
          voteAverage: movieMedia.vote_average,
          releaseDate: movieMedia.release_date,
          genreIds: movieMedia.genres?.map((g) => g.id),
        },
        preferences.autoAddToAlreadyWatched,
      )
    },
    [
      mediaType,
      detailedMedia,
      preferences.autoAddToAlreadyWatched,
      addWatchInstance,
    ],
  )

  return (
    <>
      {/* Desktop: show with preview card */}
      <div className="hidden md:block">
        <PreviewCard.Root open={isOpen} onOpenChange={setIsOpen}>
          <PreviewCard.Trigger
            render={(props) => (
              <div {...props} className="cursor-pointer">
                {mediaCard}
              </div>
            )}
          />
          <PreviewCard.Portal>
            <PreviewCard.Positioner
              sideOffset={8}
              side="right"
              className="z-9999"
            >
              <PreviewCard.Popup className="rounded-xl border border-white/10 bg-gray-900/95 shadow-2xl backdrop-blur-xl">
                {isLoadingDetails || !detailedMedia ? (
                  <MediaPreviewSkeleton />
                ) : (
                  <MediaPreviewContent
                    media={detailedMedia as TMDBMovieDetails | TMDBTVDetails}
                    mediaType={mediaType}
                    onAddToList={handleAddToList}
                    onRate={handleRate}
                    onNotes={handleNotes}
                    onMarkAsWatched={
                      mediaType === "movie"
                        ? () =>
                            requireAuth(
                              handleMarkAsWatched,
                              "Sign in to mark movies as watched",
                            )
                        : undefined
                    }
                    watchCount={watchCount}
                    isMarkAsWatchedLoading={isQuickMarkLoading}
                  />
                )}
              </PreviewCard.Popup>
            </PreviewCard.Positioner>
          </PreviewCard.Portal>
        </PreviewCard.Root>
      </div>

      {/* Mobile: show without preview card */}
      <div className="md:hidden">{mediaCard}</div>

      {/* Modals - rendered outside PreviewCard so they persist when it closes */}
      {detailedMedia && (
        <>
          <AddToListModal
            isOpen={isAddToListOpen}
            onClose={() => setIsAddToListOpen(false)}
            media={detailedMedia}
            mediaType={mediaType}
          />

          <RatingModal
            isOpen={isRatingModalOpen}
            onClose={() => setIsRatingModalOpen(false)}
            media={detailedMedia}
            mediaType={mediaType}
          />

          <NotesModal
            isOpen={isNotesModalOpen}
            onClose={() => setIsNotesModalOpen(false)}
            media={detailedMedia}
            mediaType={mediaType}
          />

          {mediaType === "movie" && (
            <MarkAsWatchedModal
              isOpen={isMarkAsWatchedOpen}
              onClose={() => setIsMarkAsWatchedOpen(false)}
              movieTitle={
                "title" in detailedMedia
                  ? detailedMedia.title
                  : "name" in detailedMedia
                    ? detailedMedia.name
                    : "Movie"
              }
              releaseDate={(detailedMedia as TMDBMovieDetails).release_date}
              watchCount={watchCount}
              onMarkAsWatched={handleModalMarkAsWatched}
              onClearAll={clearAllWatches}
            />
          )}
        </>
      )}

      <AuthModal
        isOpen={modalVisible}
        onClose={closeModal}
        message={modalMessage}
      />
    </>
  )
}
