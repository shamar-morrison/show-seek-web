"use client"

import { AuthModal } from "@/components/auth-modal"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useAuth } from "@/context/auth-context"
import { useAllSeasonEpisodes } from "@/hooks/use-all-season-episodes"
import { useAuthGuard } from "@/hooks/use-auth-guard"
import { useEpisodeTrackingMutations } from "@/hooks/use-episode-tracking-mutations"
import { useEpisodeTrackingShow } from "@/hooks/use-episode-tracking-show"
import { useListMutations } from "@/hooks/use-list-mutations"
import { usePreferences } from "@/hooks/use-preferences"
import { showActionableSuccessToast } from "@/lib/actionable-toast"
import { getMarkableEpisodes } from "@/lib/episode-eligibility"
import { parseEpisodeKey } from "@/lib/episode-utils"
import type { SeasonEpisodeInput } from "@/types/episode-tracking-inputs"
import type { TMDBSeason } from "@/types/tmdb"
import { Loading03Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useCallback, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

export interface TVShowWatchActionOptions {
  tvShowId: number
  tvShowName: string
  posterPath: string | null
  seasons: TMDBSeason[]
  showStats?: {
    totalEpisodes: number
    avgRuntime: number
  }
  voteAverage?: number
  firstAirDate?: string
  /** When false, episode/tracking fetches are disabled (e.g. hover preview closed) */
  enabled?: boolean
}

type BulkFlow = "mark" | "unmark"

type ProgressState = {
  flow: BulkFlow
  current: number
  total: number
}

/**
 * Shared show-wide "Mark as Watched" / "Mark as Unwatched" logic.
 * Ports mobile's `TVShowWatchButton` behavior: excludes specials (S0), counts
 * watched vs markable episodes with the shared `getMarkableEpisodes` filter,
 * and writes in chunks of 10 with a 300ms delay (cancellable, with progress).
 *
 * The trigger button and the dialogs are intentionally separated so hover
 * preview cards can render the trigger inside the preview popup while the
 * returned `dialogs` element is mounted outside of it (dialogs would unmount
 * with the popup if rendered inside, since opening them closes the preview).
 */
export function useTVShowWatchAction({
  tvShowId,
  tvShowName,
  posterPath,
  seasons,
  showStats,
  voteAverage,
  firstAirDate,
  enabled = true,
}: TVShowWatchActionOptions) {
  const { user } = useAuth()
  const { preferences } = usePreferences()
  const { requireAuth, modalVisible, modalMessage, closeModal, onAuthSuccess } =
    useAuthGuard()
  const { tracking, loading: trackingLoading } = useEpisodeTrackingShow(
    tvShowId,
    !!user && enabled,
  )
  const { markEntireShowWatched, markEntireShowUnwatched, isMutating } =
    useEpisodeTrackingMutations()
  const { addToList, removeFromList } = useListMutations()
  const {
    episodesBySeason,
    isLoading: isLoadingSeasons,
    isError: isEpisodesError,
    retry: retryEpisodes,
  } = useAllSeasonEpisodes(tvShowId, seasons, enabled)

  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [confirmAction, setConfirmAction] = useState<BulkFlow | null>(null)
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false)
  const [progress, setProgress] = useState<ProgressState | null>(null)
  const [isCancelling, setIsCancelling] = useState(false)
  const cancelTokenRef = useRef({ isCancelled: false })
  const doneCountRef = useRef(0)

  const allowUnreleased = !!preferences.allowUnreleasedEpisodeWatches
  const trackedEpisodes = useMemo(
    () => tracking?.episodes ?? {},
    [tracking],
  )

  const regularSeasons = useMemo(
    () => (seasons ?? []).filter((season) => season.season_number > 0),
    [seasons],
  )

  const markableBySeason = useMemo(
    () =>
      regularSeasons.map((season) => ({
        seasonNumber: season.season_number,
        episodes: getMarkableEpisodes(
          episodesBySeason.get(season.season_number) ?? [],
          allowUnreleased,
        ),
      })),
    [regularSeasons, episodesBySeason, allowUnreleased],
  )

  const totalMarkableCount = useMemo(
    () => markableBySeason.reduce((sum, season) => sum + season.episodes.length, 0),
    [markableBySeason],
  )

  const unwatchedMarkableShowEpisodes = useMemo(() => {
    const result: Array<{ seasonNumber: number; episode: SeasonEpisodeInput }> =
      []
    markableBySeason.forEach(({ seasonNumber, episodes }) => {
      episodes.forEach((episode) => {
        if (trackedEpisodes[`${seasonNumber}_${episode.episode_number}`]) return
        result.push({
          seasonNumber,
          episode: {
            id: episode.id,
            episode_number: episode.episode_number,
            name: episode.name,
            air_date: episode.air_date,
          },
        })
      })
    })
    return result
  }, [markableBySeason, trackedEpisodes])

  const watchedCount = useMemo(() => {
    let count = 0
    markableBySeason.forEach(({ seasonNumber, episodes }) => {
      episodes.forEach((episode) => {
        if (trackedEpisodes[`${seasonNumber}_${episode.episode_number}`]) {
          count += 1
        }
      })
    })
    return count
  }, [markableBySeason, trackedEpisodes])

  // Unmark/clear source: every tracked episode currently present in a regular
  // season, derived straight from the tracking keys rather than the markable
  // set. This keeps Clear Watch History from silently skipping episodes that
  // were tracked while the unreleased preference was on (or that now have a
  // null/future air date). Marking and progress still use the markable sets.
  const watchedShowEpisodesToUnmark = useMemo(() => {
    const result: Array<{ seasonNumber: number; episodeNumber: number }> = []
    for (const key of Object.keys(trackedEpisodes)) {
      const parsed = parseEpisodeKey(key)
      if (!parsed || parsed.season <= 0) continue
      result.push({ seasonNumber: parsed.season, episodeNumber: parsed.episode })
    }
    return result
  }, [trackedEpisodes])

  const isShowFullyWatched =
    regularSeasons.length > 0 && unwatchedMarkableShowEpisodes.length === 0
  const isPending = isMutating || progress !== null
  const isLoadingState = isLoadingSeasons || trackingLoading

  const runMarkWatched = useCallback(async () => {
    const totalCount = unwatchedMarkableShowEpisodes.length
    if (totalCount === 0) return

    cancelTokenRef.current = { isCancelled: false }
    doneCountRef.current = 0
    setIsCancelling(false)
    setProgress({ flow: "mark", current: 0, total: totalCount })

    try {
      await markEntireShowWatched({
        tvShowId,
        episodesToMark: unwatchedMarkableShowEpisodes,
        showMetadata: { tvShowName, posterPath },
        showStats,
        nextEpisode: null,
        bulkOptions: {
          batchSize: 10,
          delayMs: 300,
          isCancelled: () => cancelTokenRef.current.isCancelled,
          onProgress: (done, total) => {
            doneCountRef.current = done
            setProgress((current) =>
              current && current.flow === "mark"
                ? { ...current, current: done, total }
                : current,
            )
          },
        },
      })

      if (cancelTokenRef.current.isCancelled) {
        toast.info(
          `Cancelled — progress saved (${doneCountRef.current} of ${totalCount} episodes).`,
        )
      } else {
        toast.success(
          `Marked ${doneCountRef.current} episodes as watched.`,
        )

        if (preferences.autoAddToWatching) {
          try {
            const wasAdded = await addToList("currently-watching", {
              id: tvShowId,
              title: tvShowName,
              poster_path: posterPath,
              media_type: "tv",
              vote_average: voteAverage,
              first_air_date: firstAirDate,
            })

            if (wasAdded) {
              showActionableSuccessToast("Added to Watching list", {
                action: {
                  label: "Undo",
                  onClick: () =>
                    removeFromList("currently-watching", String(tvShowId)),
                  errorMessage: "Failed to remove from Watching list",
                  logMessage: "Failed to undo auto-add to Watching list:",
                },
              })
            }
          } catch (listError) {
            console.error("Failed to auto-add to Watching list:", listError)
          }
        }
      }
    } catch (error) {
      if (cancelTokenRef.current.isCancelled) {
        toast.info("Cancelled — progress saved.")
      } else {
        console.error("Failed to mark all episodes watched:", error)
        toast.error("Failed to mark all episodes watched. Please try again.")
      }
    } finally {
      setProgress(null)
      setIsCancelling(false)
    }
  }, [
    unwatchedMarkableShowEpisodes,
    markEntireShowWatched,
    tvShowId,
    tvShowName,
    posterPath,
    showStats,
    preferences.autoAddToWatching,
    addToList,
    removeFromList,
    voteAverage,
    firstAirDate,
  ])

  const runMarkUnwatched = useCallback(async () => {
    const totalCount = watchedShowEpisodesToUnmark.length
    if (totalCount === 0) return

    cancelTokenRef.current = { isCancelled: false }
    doneCountRef.current = 0
    setIsCancelling(false)
    setProgress({ flow: "unmark", current: 0, total: totalCount })

    try {
      await markEntireShowUnwatched({
        tvShowId,
        episodesToUnmark: watchedShowEpisodesToUnmark,
        bulkOptions: {
          batchSize: 10,
          delayMs: 300,
          isCancelled: () => cancelTokenRef.current.isCancelled,
          onProgress: (done, total) => {
            doneCountRef.current = done
            setProgress((current) =>
              current && current.flow === "unmark"
                ? { ...current, current: done, total }
                : current,
            )
          },
        },
      })

      if (cancelTokenRef.current.isCancelled) {
        toast.info(
          `Cancelled — progress saved (${doneCountRef.current} of ${totalCount} episodes).`,
        )
      } else {
        toast.success(`Unmarked ${doneCountRef.current} episodes.`)
      }
    } catch (error) {
      if (cancelTokenRef.current.isCancelled) {
        toast.info("Cancelled — progress saved.")
      } else {
        console.error("Failed to unmark all episodes:", error)
        toast.error("Failed to unmark all episodes. Please try again.")
      }
    } finally {
      setProgress(null)
      setIsCancelling(false)
    }
  }, [watchedShowEpisodesToUnmark, markEntireShowUnwatched, tvShowId])

  const handleConfirm = useCallback(async () => {
    setShowConfirmDialog(false)
    if (confirmAction === "mark") {
      await runMarkWatched()
    } else if (confirmAction === "unmark") {
      await runMarkUnwatched()
    }
  }, [confirmAction, runMarkWatched, runMarkUnwatched])

  const handleClearHistory = useCallback(async () => {
    setIsClearConfirmOpen(false)
    await runMarkUnwatched()
  }, [runMarkUnwatched])

  const handleCancel = useCallback(() => {
    cancelTokenRef.current.isCancelled = true
    setIsCancelling(true)
  }, [])

  const requestPrimaryAction = useCallback(
    (onBeforeDialogOpen?: () => void) => {
      requireAuth(
        () => {
          if (isPending) return

          if (isShowFullyWatched) {
            if (watchedShowEpisodesToUnmark.length === 0) return
            onBeforeDialogOpen?.()
            setConfirmAction("unmark")
            setShowConfirmDialog(true)
            return
          }

          if (unwatchedMarkableShowEpisodes.length === 0) {
            toast.info("You're all caught up — nothing left to mark.")
            return
          }

          onBeforeDialogOpen?.()
          setConfirmAction("mark")
          setShowConfirmDialog(true)
        },
        "Sign in to track your watch progress",
      )
    },
    [
      requireAuth,
      isPending,
      isShowFullyWatched,
      watchedShowEpisodesToUnmark.length,
      unwatchedMarkableShowEpisodes.length,
    ],
  )

  const openClearConfirm = useCallback(
    (onBeforeDialogOpen?: () => void) => {
      requireAuth(
        () => {
          onBeforeDialogOpen?.()
          setIsClearConfirmOpen(true)
        },
        "Sign in to track your watch progress",
      )
    },
    [requireAuth],
  )

  // Hide only when there is genuinely nothing to do: no markable episodes AND
  // no tracked episodes. A show can have zero markable episodes while still
  // having watched episodes tracked (e.g. marked while
  // allowUnreleasedEpisodeWatches was on, then the preference was toggled off),
  // so the button must stay visible in its unmark/clear state for those.
  const hasNothingToDo =
    totalMarkableCount === 0 && watchedShowEpisodesToUnmark.length === 0
  const shouldRender = regularSeasons.length > 0 && !hasNothingToDo

  const hasWatched = watchedShowEpisodesToUnmark.length > 0
  const label = isShowFullyWatched
    ? "Mark as Unwatched"
    : watchedCount > 0
      ? `${watchedCount}/${totalMarkableCount} Episodes Watched`
      : "Mark as Watched"

  // Visual fill mirrors mobile's ProgressBar overlay: translucent accent while
  // in progress, translucent success once complete. Fully-watched is forced to
  // ratio 1 so the zero-markable-but-tracked edge case still fills completely.
  const fillRatio = isShowFullyWatched
    ? 1
    : totalMarkableCount > 0
      ? Math.min(watchedCount / totalMarkableCount, 1)
      : 0

  const dialogsOpen =
    showConfirmDialog ||
    isClearConfirmOpen ||
    progress !== null ||
    modalVisible

  const dialogs = (
    <>
      {/* Bulk mark/unmark confirm */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmAction === "unmark"
                ? "Unmark All Episodes?"
                : "Mark All Episodes Watched?"}
            </DialogTitle>
            <DialogDescription>
              {confirmAction === "unmark"
                ? `This will unmark all ${watchedShowEpisodesToUnmark.length} watched episodes across the show.`
                : allowUnreleased
                  ? `This will mark all ${unwatchedMarkableShowEpisodes.length} episodes across ${regularSeasons.length} season${regularSeasons.length === 1 ? "" : "s"} as watched, including unreleased episodes.`
                  : `This will mark all ${unwatchedMarkableShowEpisodes.length} aired episodes across ${regularSeasons.length} season${regularSeasons.length === 1 ? "" : "s"} as watched.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleConfirm}>
              {confirmAction === "unmark" ? "Unmark All" : "Mark All Watched"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear watch history confirm */}
      <AlertDialog
        open={isClearConfirmOpen}
        onOpenChange={setIsClearConfirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all watched episodes?</AlertDialogTitle>
            <AlertDialogDescription>
              This will unmark all {watchedShowEpisodesToUnmark.length} watched
              episodes across all seasons. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearHistory}
              disabled={isPending}
              data-testid="tv-show-clear-history-confirm"
              className="bg-red-600 hover:bg-red-700"
            >
              Clear watch history
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Blocking progress modal (mobile LoadingModal parity) */}
      <Dialog open={progress !== null} onOpenChange={() => {}}>
        <DialogContent
          showCloseButton={false}
          data-testid="tv-show-watch-progress"
        >
          <DialogHeader>
            <DialogTitle>
              {isCancelling
                ? "Cancelling…"
                : progress?.flow === "unmark"
                  ? "Unmarking episodes…"
                  : "Marking episodes…"}
            </DialogTitle>
            <DialogDescription data-testid="tv-show-watch-progress-text">
              {`${progress?.flow === "unmark" ? "Unmarked" : "Marked"} ${progress?.current ?? 0} of ${progress?.total ?? 0} episodes.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isCancelling}
              data-testid="tv-show-watch-cancel"
            >
              {isCancelling ? (
                <>
                  <HugeiconsIcon
                    icon={Loading03Icon}
                    className="mr-2 size-4 animate-spin"
                  />
                  Cancelling…
                </>
              ) : (
                "Cancel"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AuthModal
        isOpen={modalVisible}
        onClose={closeModal}
        message={modalMessage}
        onAuthSuccess={onAuthSuccess}
      />
    </>
  )

  return {
    shouldRender,
    hasWatched,
    label,
    isShowFullyWatched,
    fillRatio,
    watchedCount,
    totalMarkableCount,
    isPending,
    isLoadingState,
    isEpisodesError,
    retryEpisodes,
    requestPrimaryAction,
    openClearConfirm,
    dialogsOpen,
    dialogs,
  }
}

export type TVShowWatchAction = ReturnType<typeof useTVShowWatchAction>
