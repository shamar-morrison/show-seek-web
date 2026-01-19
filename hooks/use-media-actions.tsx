"use client"

import type { DropdownMenuItem } from "@/components/media-card-dropdown-menu"
import { useAuthGuard } from "@/hooks/use-auth-guard"
import { useLists } from "@/hooks/use-lists"
import { useNotes } from "@/hooks/use-notes"
import { usePreferences } from "@/hooks/use-preferences"
import { useRatings } from "@/hooks/use-ratings"
import { useWatchedMovies } from "@/hooks/use-watched-movies"
import type { Note } from "@/types/note"
import type { Rating } from "@/types/rating"
import type { TMDBMedia, TMDBMovieDetails, TMDBTVDetails } from "@/types/tmdb"
import {
  CheckmarkCircle02Icon,
  Note01Icon,
  NoteDoneIcon,
  PlusSignIcon,
  StarIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import dynamic from "next/dynamic"
import { useCallback, useMemo, useState } from "react"

const AddToListModal = dynamic(
  () =>
    import("@/components/add-to-list-modal").then((mod) => mod.AddToListModal),
  { ssr: false },
)
const AuthModal = dynamic(
  () => import("@/components/auth-modal").then((mod) => mod.AuthModal),
  { ssr: false },
)
const MarkAsWatchedModal = dynamic(
  () =>
    import("@/components/mark-as-watched-modal").then(
      (mod) => mod.MarkAsWatchedModal,
    ),
  { ssr: false },
)
const NotesModal = dynamic(
  () => import("@/components/notes-modal").then((mod) => mod.NotesModal),
  { ssr: false },
)
const RatingModal = dynamic(
  () => import("@/components/rating-modal").then((mod) => mod.RatingModal),
  { ssr: false },
)

interface UseMediaActionsOptions {
  /** Media item to perform actions on */
  media: TMDBMedia | TMDBMovieDetails | TMDBTVDetails
  /** Media type */
  mediaType: "movie" | "tv"
}

interface UseMediaActionsResult {
  /** Handler to open the add-to-list modal */
  openListModal: () => void
  /** Handler to open the rating modal */
  openRatingModal: () => void
  /** Handler to open the notes modal */
  openNotesModal: () => void
  /** Whether the media is in any list */
  isInAnyList: boolean
  /** User's rating for this media, if any */
  userRating: Rating | null
  /** User's note for this media, if any */
  userNote: Note | null
  /** List IDs the media is in (if preference enabled), for display indicators */
  listIds: string[] | undefined
  /** Pre-built dropdown menu items */
  dropdownItems: DropdownMenuItem[]
  /** Memoized JSX element tree of all modals - must be included in the render tree */
  modals: React.ReactNode
}

/**
 * Hook for managing media card actions (Add to List, Rate, Notes)
 * Returns handlers, state, and a memoized modals element tree
 */
export function useMediaActions({
  media,
  mediaType,
}: UseMediaActionsOptions): UseMediaActionsResult {
  // Modal open states
  const [isAddToListOpen, setIsAddToListOpen] = useState(false)
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false)
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false)
  const [isMarkAsWatchedOpen, setIsMarkAsWatchedOpen] = useState(false)
  const [isQuickMarkLoading, setIsQuickMarkLoading] = useState(false)

  // Data hooks
  const { lists } = useLists()
  const { preferences } = usePreferences()
  const { getRating } = useRatings()
  const { getNote } = useNotes()
  const { requireAuth, modalVisible, modalMessage, closeModal } = useAuthGuard()

  // Watch history for movies only
  // Watch history for movies only - Disable subscription for performance
  const {
    count: watchCount,
    addWatchInstance,
    clearAllWatches,
  } = useWatchedMovies(mediaType === "movie" ? media.id : 0, { enabled: false })

  // Check if media is in "already-watched" list (alternative to real-time subscription)
  const isWatched = useMemo(() => {
    if (mediaType !== "movie") return false
    const list = lists.find((l) => l.id === "already-watched")
    if (!list?.items) return false
    const numericKey = String(media.id)
    // Keys in lists are stored as numeric ID strings (from mobile) or sometimes other formats
    // We check the numeric ID which handles most cases
    return !!list.items[numericKey]
  }, [lists, media.id, mediaType])

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

  // Get lists the media is in (if preference enabled)
  const listIds = useMemo(() => {
    if (!preferences.showListIndicators) return undefined

    const numericKey = String(media.id)
    return lists
      .filter((list) => list.items && list.items[numericKey])
      .map((list) => list.id)
  }, [lists, media.id, preferences.showListIndicators])

  // Handlers with auth guard
  const openListModal = useCallback(() => {
    requireAuth(() => setIsAddToListOpen(true), "Sign in to add to your lists")
  }, [requireAuth])

  const openRatingModal = useCallback(() => {
    requireAuth(
      () => setIsRatingModalOpen(true),
      "Sign in to rate movies and TV shows",
    )
  }, [requireAuth])

  const openNotesModal = useCallback(() => {
    requireAuth(
      () => setIsNotesModalOpen(true),
      "Sign in to add personal notes",
    )
  }, [requireAuth])

  // Handle Mark as Watched action - only for movies
  const handleMarkAsWatched = useCallback(async () => {
    if (mediaType !== "movie") return

    const movieMedia = media as TMDBMovieDetails

    if (preferences.quickMarkAsWatched) {
      // Quick mark - immediately mark as watched with current time
      setIsQuickMarkLoading(true)
      try {
        await addWatchInstance(
          new Date(),
          {
            title:
              movieMedia.title ||
              (movieMedia as unknown as TMDBMedia).name ||
              "Unknown",
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
      setIsMarkAsWatchedOpen(true)
    }
  }, [
    mediaType,
    media,
    preferences.quickMarkAsWatched,
    preferences.autoAddToAlreadyWatched,
    addWatchInstance,
  ])

  const openMarkAsWatchedModal = useCallback(() => {
    requireAuth(handleMarkAsWatched, "Sign in to mark movies as watched")
  }, [requireAuth, handleMarkAsWatched])

  // Handle mark as watched from modal
  const handleModalMarkAsWatched = useCallback(
    async (date: Date) => {
      if (mediaType !== "movie") return
      const movieMedia = media as TMDBMovieDetails
      await addWatchInstance(
        date,
        {
          title:
            movieMedia.title ||
            (movieMedia as unknown as TMDBMedia).name ||
            "Unknown",
          posterPath: movieMedia.poster_path,
          voteAverage: movieMedia.vote_average,
          releaseDate: movieMedia.release_date,
          genreIds: movieMedia.genres?.map((g) => g.id),
        },
        preferences.autoAddToAlreadyWatched,
      )
    },
    [mediaType, media, preferences.autoAddToAlreadyWatched, addWatchInstance],
  )

  // Build dropdown items
  const dropdownItems: DropdownMenuItem[] = useMemo(() => {
    const items: DropdownMenuItem[] = [
      {
        id: "add-to-list",
        label: isInAnyList ? "In List" : "Add to List",
        icon: ({ className }) => (
          <HugeiconsIcon
            icon={isInAnyList ? Tick02Icon : PlusSignIcon}
            className={className}
          />
        ),
        onClick: openListModal,
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
        onClick: openRatingModal,
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
        onClick: openNotesModal,
      },
    ]

    // Add Mark as Watched for movies only
    if (mediaType === "movie") {
      const watchedLabel = isWatched ? "Watched" : "Mark as Watched"
      items.push({
        id: "mark-as-watched",
        label: isQuickMarkLoading ? "Marking..." : watchedLabel,
        icon: ({ className }) => (
          <HugeiconsIcon
            icon={CheckmarkCircle02Icon}
            className={`${className} ${isWatched ? "fill-green-500 text-green-500" : ""}`}
          />
        ),
        onClick: openMarkAsWatchedModal,
        disabled: isQuickMarkLoading,
      })
    }

    return items
  }, [
    isInAnyList,
    userRating,
    userNote,
    openListModal,
    openRatingModal,
    openNotesModal,
    mediaType,
    watchCount,
    isQuickMarkLoading,
    openMarkAsWatchedModal,
  ])

  // Convert media to modal-compatible format
  const mediaForModal = media as unknown as TMDBMovieDetails | TMDBTVDetails

  // Memoized JSX element tree for all modals (not a component to avoid remounts)
  const modals = useMemo(
    () => (
      <>
        <>
          {/* Add to List Modal */}
          {isAddToListOpen && (
            <AddToListModal
              isOpen={isAddToListOpen}
              onClose={() => setIsAddToListOpen(false)}
              media={mediaForModal}
              mediaType={mediaType}
            />
          )}

          {/* Rating Modal */}
          {isRatingModalOpen && (
            <RatingModal
              isOpen={isRatingModalOpen}
              onClose={() => setIsRatingModalOpen(false)}
              media={mediaForModal}
              mediaType={mediaType}
            />
          )}

          {/* Notes Modal */}
          {isNotesModalOpen && (
            <NotesModal
              isOpen={isNotesModalOpen}
              onClose={() => setIsNotesModalOpen(false)}
              media={mediaForModal}
              mediaType={mediaType}
            />
          )}

          {/* Mark as Watched Modal - Movies only */}
          {mediaType === "movie" && isMarkAsWatchedOpen && (
            <MarkAsWatchedModal
              isOpen={isMarkAsWatchedOpen}
              onClose={() => setIsMarkAsWatchedOpen(false)}
              movieTitle={
                "title" in mediaForModal
                  ? mediaForModal.title
                  : "name" in mediaForModal
                    ? mediaForModal.name
                    : "Movie"
              }
              releaseDate={(mediaForModal as TMDBMovieDetails).release_date}
              watchCount={watchCount}
              onMarkAsWatched={handleModalMarkAsWatched}
              onClearAll={clearAllWatches}
            />
          )}

          {/* Auth Modal for unauthenticated users */}
          {modalVisible && (
            <AuthModal
              isOpen={modalVisible}
              onClose={closeModal}
              message={modalMessage}
            />
          )}
        </>
      </>
    ),
    [
      isAddToListOpen,
      isRatingModalOpen,
      isNotesModalOpen,
      isMarkAsWatchedOpen,
      modalVisible,
      modalMessage,
      closeModal,
      mediaForModal,
      mediaType,
      watchCount,
      handleModalMarkAsWatched,
      clearAllWatches,
    ],
  )

  return {
    openListModal,
    openRatingModal,
    openNotesModal,
    isInAnyList,
    userRating,
    userNote,
    listIds,
    dropdownItems,
    modals,
  }
}
