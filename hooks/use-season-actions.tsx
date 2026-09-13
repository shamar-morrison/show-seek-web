"use client"

import { fetchSeasonEpisodes } from "@/app/actions"
import { AuthModal } from "@/components/auth-modal"
import type { DropdownMenuItem } from "@/components/media-card-dropdown-menu"
import { SeasonRatingModal } from "@/components/season-rating-modal"
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
import { useAuthGuard } from "@/hooks/use-auth-guard"
import { useEpisodeTrackingMutations } from "@/hooks/use-episode-tracking-mutations"
import { useNotes } from "@/hooks/use-notes"
import { usePreferences } from "@/hooks/use-preferences"
import { useRatings } from "@/hooks/use-ratings"
import { isTmdbDateOnOrBeforeToday } from "@/lib/tmdb-date"
import type { TVShowEpisodeTracking } from "@/types/episode-tracking"
import type { SeasonEpisodeInput } from "@/types/episode-tracking-inputs"
import type { TMDBSeason } from "@/types/tmdb"
import {
  CheckmarkCircle02Icon,
  Note01Icon,
  NoteDoneIcon,
  StarIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import dynamic from "next/dynamic"
import { useCallback, useMemo, useState } from "react"
import { toast } from "sonner"

const NotesModal = dynamic(
  () => import("@/components/notes-modal").then((mod) => mod.NotesModal),
  { ssr: false },
)

interface UseSeasonActionsOptions {
  /** TMDB TV show id */
  tvShowId: number
  /** TV show name for tracking metadata and dialogs */
  tvShowName: string
  /** Show-level poster fallback when the season has none */
  posterPath?: string | null
  /** Season summary from the TV details row */
  season: TMDBSeason
  /** Watched episode count (computed by the row) */
  watchedCount: number
  /** Total episode count (computed by the row) */
  totalCount: number
  /** Full episode tracking map for deriving watched episode numbers */
  tracking: Map<string, TVShowEpisodeTracking>
  /** Optional show stats for tracking metadata caching */
  showStats?: {
    totalEpisodes: number
    avgRuntime: number
  }
}

interface UseSeasonActionsResult {
  /** Pre-built dropdown menu items for the season card */
  dropdownItems: DropdownMenuItem[]
  /** Memoized JSX element tree of all modals - must be included in the render tree */
  modals: React.ReactNode
}

/**
 * Hook for season card quick actions (Mark/Unmark season watched, Rate season).
 * Mirrors the season details screen flows without navigating away:
 * episodes are fetched on demand, unaired episodes follow the
 * allowUnreleasedEpisodeWatches preference, and bulk marks go through a
 * confirm dialog with the same copy as season details.
 */
export function useSeasonActions({
  tvShowId,
  tvShowName,
  posterPath,
  season,
  watchedCount,
  totalCount,
  tracking,
  showStats,
}: UseSeasonActionsOptions): UseSeasonActionsResult {
  const { user } = useAuth()
  const { preferences } = usePreferences()
  const { getSeasonRating } = useRatings()
  const { getNote } = useNotes()
  const { requireAuth, modalVisible, modalMessage, closeModal, onAuthSuccess } =
    useAuthGuard()
  const { markAllEpisodesWatched, markAllEpisodesUnwatched, isMutating } =
    useEpisodeTrackingMutations()

  const [isLoadingEpisodes, setIsLoadingEpisodes] = useState(false)
  const [isMarking, setIsMarking] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false)
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false)
  const [pendingMark, setPendingMark] = useState<SeasonEpisodeInput[] | null>(
    null,
  )
  const [pendingUnmark, setPendingUnmark] = useState<number[] | null>(null)

  const seasonNumber = season.season_number
  const allWatched = totalCount > 0 && watchedCount >= totalCount
  const isBusy = isLoadingEpisodes || isMarking || isMutating
  const seasonRating = getSeasonRating(tvShowId, seasonNumber)
  const seasonNote = getNote("season", tvShowId, seasonNumber)

  const showMetadata = useMemo(
    () => ({
      tvShowName,
      posterPath: season.poster_path ?? posterPath ?? null,
    }),
    [tvShowName, season.poster_path, posterPath],
  )

  // Episode numbers in this season already marked watched.
  const getWatchedEpisodeNumbers = useCallback(
    (episodeNumbers: number[]): number[] => {
      const episodes = tracking.get(tvShowId.toString())?.episodes ?? {}
      return episodeNumbers.filter((episodeNumber) =>
        Object.keys(episodes).some((key) => {
          const match = key.match(/^(\d+)_(\d+)$/)
          return (
            match &&
            parseInt(match[1], 10) === seasonNumber &&
            parseInt(match[2], 10) === episodeNumber
          )
        }),
      )
    },
    [tracking, tvShowId, seasonNumber],
  )

  // Load episodes on demand and stage a mark/unmark run behind the confirm dialog.
  const openMarkFlow = useCallback(() => {
    requireAuth(async () => {
      if (isLoadingEpisodes || isMarking || isMutating) return

      setIsLoadingEpisodes(true)
      try {
        const episodes =
          (await fetchSeasonEpisodes(tvShowId, seasonNumber)) ?? []

        if (episodes.length === 0) {
          toast.info("No episodes available for this season yet.")
          return
        }

        const allowUnreleased = !!preferences.allowUnreleasedEpisodeWatches

        if (allWatched) {
          const watchedEpisodeNumbers = getWatchedEpisodeNumbers(
            episodes.map((episode) => episode.episode_number),
          )
          if (watchedEpisodeNumbers.length === 0) return
          setPendingUnmark(watchedEpisodeNumbers)
          setPendingMark(null)
          setShowConfirmDialog(true)
          return
        }

        const trackedKeys = new Set(
          Object.keys(tracking.get(tvShowId.toString())?.episodes ?? {}),
        )
        const episodesToMark = episodes
          .filter((episode) => {
            if (trackedKeys.has(`${seasonNumber}_${episode.episode_number}`)) {
              return false
            }
            // Same mobile gating as season details: allowUnreleased bypasses
            // the date check; episodes without an air date need the opt-in.
            return (
              allowUnreleased ||
              (!!episode.air_date &&
                isTmdbDateOnOrBeforeToday(episode.air_date))
            )
          })
          .map((episode) => ({
            id: episode.id,
            episode_number: episode.episode_number,
            name: episode.name,
            air_date: episode.air_date,
          }))

        if (episodesToMark.length === 0) {
          toast.info("You're all caught up — nothing left to mark.")
          return
        }

        setPendingMark(episodesToMark)
        setPendingUnmark(null)
        setShowConfirmDialog(true)
      } catch (error) {
        console.error("Failed to load season episodes:", error)
        toast.error("Failed to load season episodes. Please try again.")
      } finally {
        setIsLoadingEpisodes(false)
      }
    }, "Sign in to track episodes")
  }, [
    requireAuth,
    isLoadingEpisodes,
    isMarking,
    isMutating,
    tvShowId,
    seasonNumber,
    allWatched,
    getWatchedEpisodeNumbers,
    tracking,
    preferences.allowUnreleasedEpisodeWatches,
  ])

  const handleConfirm = useCallback(async () => {
    if (!user) return

    setShowConfirmDialog(false)
    setIsMarking(true)
    try {
      if (pendingUnmark) {
        await markAllEpisodesUnwatched({
          tvShowId,
          seasonNumber,
          episodeNumbers: pendingUnmark,
        })
      } else if (pendingMark) {
        await markAllEpisodesWatched({
          tvShowId,
          seasonNumber,
          episodes: pendingMark,
          showMetadata,
          showStats,
        })
      }
    } catch (error) {
      console.error("Failed to update season watched state:", error)
      toast.error(
        pendingUnmark
          ? "Failed to unmark all episodes. Please try again."
          : "Failed to mark all episodes watched. Please try again.",
      )
    } finally {
      setIsMarking(false)
      setPendingMark(null)
      setPendingUnmark(null)
    }
  }, [
    user,
    pendingUnmark,
    pendingMark,
    markAllEpisodesUnwatched,
    markAllEpisodesWatched,
    tvShowId,
    seasonNumber,
    showMetadata,
    showStats,
  ])

  const openRatingModal = useCallback(() => {
    requireAuth(() => setIsRatingModalOpen(true), "Sign in to rate seasons")
  }, [requireAuth])

  const openNotesModal = useCallback(() => {
    requireAuth(
      () => setIsNotesModalOpen(true),
      "Sign in to add personal notes",
    )
  }, [requireAuth])

  const dropdownItems: DropdownMenuItem[] = useMemo(() => {
    const markLabel = isBusy
      ? pendingUnmark
        ? "Unmarking..."
        : "Marking..."
      : allWatched
        ? "Unmark Season"
        : "Mark Season Watched"
    return [
      {
        id: "mark-season",
        label: markLabel,
        icon: ({ className }) => (
          <HugeiconsIcon
            icon={CheckmarkCircle02Icon}
            className={`${className} ${allWatched ? "fill-green-500 text-green-500" : ""}`}
          />
        ),
        onClick: openMarkFlow,
        disabled: isBusy,
      },
      {
        id: "rate-season",
        label: seasonRating ? `${seasonRating.rating}/10` : "Rate Season",
        icon: ({ className }) => (
          <HugeiconsIcon
            icon={StarIcon}
            className={`${className} ${seasonRating ? "fill-yellow-500 text-yellow-500" : ""}`}
          />
        ),
        onClick: openRatingModal,
      },
      {
        id: "season-notes",
        label: seasonNote ? "View Note" : "Notes",
        icon: ({ className }) => (
          <HugeiconsIcon
            icon={seasonNote ? NoteDoneIcon : Note01Icon}
            className={`${className} ${seasonNote ? "text-primary" : ""}`}
          />
        ),
        onClick: openNotesModal,
      },
    ]
  }, [
    isBusy,
    pendingUnmark,
    allWatched,
    seasonRating,
    seasonNote,
    openMarkFlow,
    openRatingModal,
    openNotesModal,
  ])

  const pendingCount = pendingUnmark?.length ?? pendingMark?.length ?? 0
  const confirmDescription = pendingUnmark
    ? `This will unmark all ${pendingCount} episodes in ${season.name} as unwatched.`
    : preferences.allowUnreleasedEpisodeWatches
      ? `This will mark all ${pendingCount} episodes in ${season.name} as watched, including unreleased episodes.`
      : `This will mark all ${pendingCount} aired episodes in ${season.name} as watched.`

  const modals = useMemo(
    () => (
      <>
        <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {pendingUnmark
                  ? "Unmark All Episodes?"
                  : "Mark All Episodes Watched?"}
              </DialogTitle>
              <DialogDescription>{confirmDescription}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowConfirmDialog(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleConfirm}>
                {pendingUnmark ? "Unmark All" : "Mark All Watched"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {isRatingModalOpen && (
          <SeasonRatingModal
            isOpen={isRatingModalOpen}
            onClose={() => setIsRatingModalOpen(false)}
            season={season}
            tvShowId={tvShowId}
            tvShowName={tvShowName}
            fallbackPosterPath={posterPath ?? null}
          />
        )}

        {isNotesModalOpen && (
          <NotesModal
            isOpen={isNotesModalOpen}
            onClose={() => setIsNotesModalOpen(false)}
            media={{
              id: tvShowId,
              poster_path: season.poster_path ?? posterPath ?? null,
              name: tvShowName ? `${tvShowName} - ${season.name}` : season.name,
              show_id: tvShowId,
              season_number: seasonNumber,
            }}
            mediaType="season"
          />
        )}

        {modalVisible && (
          <AuthModal
            isOpen={modalVisible}
            onClose={closeModal}
            message={modalMessage}
            onAuthSuccess={onAuthSuccess}
          />
        )}
      </>
    ),
    [
      showConfirmDialog,
      pendingUnmark,
      confirmDescription,
      handleConfirm,
      isRatingModalOpen,
      isNotesModalOpen,
      season,
      tvShowId,
      tvShowName,
      seasonNumber,
      posterPath,
      modalVisible,
      modalMessage,
      closeModal,
      onAuthSuccess,
    ],
  )

  return { dropdownItems, modals }
}
