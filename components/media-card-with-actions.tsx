"use client"

import { AddToListModal } from "@/components/add-to-list-modal"
import { AuthModal } from "@/components/auth-modal"
import { MediaCard } from "@/components/media-card"
import type { DropdownMenuItem } from "@/components/media-card-dropdown-menu"
import { NotesModal } from "@/components/notes-modal"
import { RatingModal } from "@/components/rating-modal"
import { useAuthGuard } from "@/hooks/use-auth-guard"
import { useLists } from "@/hooks/use-lists"
import { useNotes } from "@/hooks/use-notes"
import { useRatings } from "@/hooks/use-ratings"
import type { TMDBMedia, TMDBMovieDetails, TMDBTVDetails } from "@/types/tmdb"
import {
  Note01Icon,
  NoteDoneIcon,
  PlusSignIcon,
  StarIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useMemo, useState } from "react"

interface MediaCardWithActionsProps {
  media: TMDBMedia
  onWatchTrailer?: (media: TMDBMedia) => void
  isLoading?: boolean
  priority?: boolean
  showRating?: boolean
  buttonText?: string
}

/**
 * MediaCard wrapper that adds dropdown actions for Add to List, Rate, and Notes.
 * Handles auth guard and modals internally.
 */
export function MediaCardWithActions({
  media,
  onWatchTrailer,
  isLoading = false,
  priority = false,
  showRating = false,
  buttonText,
}: MediaCardWithActionsProps) {
  const [isAddToListOpen, setIsAddToListOpen] = useState(false)
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false)
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false)

  const { lists } = useLists()
  const { getRating } = useRatings()
  const { getNote } = useNotes()
  const { requireAuth, modalVisible, modalMessage, closeModal } = useAuthGuard()

  // Determine media type
  const mediaType = media.media_type === "movie" ? "movie" : "tv"

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

  // Build dropdown items
  const dropdownItems: DropdownMenuItem[] = useMemo(() => {
    return [
      {
        id: "add-to-list",
        label: isInAnyList ? "In List" : "Add to List",
        icon: ({ className }) => (
          <HugeiconsIcon
            icon={isInAnyList ? Tick02Icon : PlusSignIcon}
            className={className}
          />
        ),
        onClick: () => {
          requireAuth(
            () => setIsAddToListOpen(true),
            "Sign in to add to your lists",
          )
        },
      },
      {
        id: "rate",
        label: userRating ? `${userRating.rating}/10` : "Rate",
        icon: ({ className }) => (
          <HugeiconsIcon
            icon={StarIcon}
            className={`${className} ${userRating ? "fill-yellow-500 text-yellow-500" : ""}`}
          />
        ),
        onClick: () => {
          requireAuth(
            () => setIsRatingModalOpen(true),
            "Sign in to rate movies and TV shows",
          )
        },
      },
      {
        id: "notes",
        label: userNote ? "View Note" : "Notes",
        icon: ({ className }) => (
          <HugeiconsIcon
            icon={userNote ? NoteDoneIcon : Note01Icon}
            className={`${className} ${userNote ? "text-primary" : ""}`}
          />
        ),
        onClick: () => {
          requireAuth(
            () => setIsNotesModalOpen(true),
            "Sign in to add personal notes",
          )
        },
      },
    ]
  }, [isInAnyList, userRating, userNote, requireAuth])

  // Convert TMDBMedia to modal-compatible format
  const mediaForModal = media as unknown as TMDBMovieDetails | TMDBTVDetails

  return (
    <>
      <MediaCard
        media={media}
        onWatchTrailer={onWatchTrailer}
        isLoading={isLoading}
        priority={priority}
        showRating={showRating}
        buttonText={buttonText}
        dropdownItems={dropdownItems}
        userRating={userRating?.rating}
      />

      {/* Add to List Modal */}
      <AddToListModal
        isOpen={isAddToListOpen}
        onClose={() => setIsAddToListOpen(false)}
        media={mediaForModal}
        mediaType={mediaType}
      />

      {/* Rating Modal */}
      <RatingModal
        isOpen={isRatingModalOpen}
        onClose={() => setIsRatingModalOpen(false)}
        media={mediaForModal}
        mediaType={mediaType}
      />

      {/* Notes Modal */}
      <NotesModal
        isOpen={isNotesModalOpen}
        onClose={() => setIsNotesModalOpen(false)}
        media={mediaForModal}
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
