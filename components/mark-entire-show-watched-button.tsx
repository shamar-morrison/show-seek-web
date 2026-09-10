"use client"

import { fetchSeasonEpisodes } from "@/app/actions"
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
import { useAuth } from "@/context/auth-context"
import { useAuthGuard } from "@/hooks/use-auth-guard"
import { useEpisodeTrackingMutations } from "@/hooks/use-episode-tracking-mutations"
import { useEpisodeTrackingShow } from "@/hooks/use-episode-tracking-show"
import { useListMutations } from "@/hooks/use-list-mutations"
import { usePreferences } from "@/hooks/use-preferences"
import { showActionableSuccessToast } from "@/lib/actionable-toast"
import { createRateLimitedQueryFn } from "@/lib/react-query/rate-limited-query"
import { isTmdbDateOnOrBeforeToday } from "@/lib/tmdb-date"
import type { SeasonEpisodeInput } from "@/types/episode-tracking-inputs"
import type { TMDBSeason } from "@/types/tmdb"
import {
  CheckmarkCircle02Icon,
  Loading03Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useCallback, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

interface MarkEntireShowWatchedButtonProps {
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
}

type EpisodeToMark = {
  seasonNumber: number
  episode: SeasonEpisodeInput
}

/**
 * Show-wide "Mark all watched" button for the Seasons section.
 * Ports the mobile TVSeasonsScreen header action: excludes specials (S0),
 * skips already-watched episodes, gates unaired episodes behind the
 * allowUnreleasedEpisodeWatches preference, writes in chunks of 10 with a
 * 300ms delay (cancellable, with progress), and auto-adds to Watching.
 * Season episode reads go through the TMDB rate-limited queue.
 */
export function MarkEntireShowWatchedButton({
  tvShowId,
  tvShowName,
  posterPath,
  seasons,
  showStats,
  voteAverage,
  firstAirDate,
}: MarkEntireShowWatchedButtonProps) {
  const { user } = useAuth()
  const { requireAuth, modalVisible, modalMessage, closeModal } = useAuthGuard()
  const { preferences } = usePreferences()
  const { tracking } = useEpisodeTrackingShow(tvShowId, !!user)
  const { markEntireShowWatched, isMutating } = useEpisodeTrackingMutations()
  const { addToList, removeFromList } = useListMutations()

  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [isLoadingEpisodes, setIsLoadingEpisodes] = useState(false)
  const [progress, setProgress] = useState<{
    current: number
    total: number
  } | null>(null)
  const [isCancelling, setIsCancelling] = useState(false)
  const [pendingEpisodes, setPendingEpisodes] = useState<EpisodeToMark[]>([])
  const cancelTokenRef = useRef({ isCancelled: false })
  const markedCountRef = useRef(0)

  const regularSeasons = useMemo(
    () => (seasons ?? []).filter((s) => s.season_number > 0),
    [seasons],
  )

  const allowUnreleased = !!preferences.allowUnreleasedEpisodeWatches

  const loadMarkableEpisodes = useCallback(async (): Promise<
    EpisodeToMark[]
  > => {
    const trackedKeys = new Set(Object.keys(tracking?.episodes ?? {}))

    // Fan out per-season reads through the TMDB rate-limited queue
    // (10/batch + 300ms gap, stays under the 40 req/s limit).
    const seasonEpisodes = await Promise.all(
      regularSeasons.map((season) =>
        createRateLimitedQueryFn(() =>
          fetchSeasonEpisodes(tvShowId, season.season_number).then(
            (episodes) => ({
              seasonNumber: season.season_number,
              episodes: episodes ?? [],
            }),
          ),
        )(),
      ),
    )

    const result: EpisodeToMark[] = []
    for (const { seasonNumber, episodes } of seasonEpisodes) {
      for (const episode of episodes) {
        const key = `${seasonNumber}_${episode.episode_number}`
        if (trackedKeys.has(key)) continue

        // Exact mobile gating: allowUnreleased bypasses the date check;
        // episodes without an air date are only markable when allowed.
        const isEligible =
          allowUnreleased ||
          (!!episode.air_date &&
            isTmdbDateOnOrBeforeToday(episode.air_date))
        if (!isEligible) continue

        result.push({
          seasonNumber,
          episode: {
            id: episode.id,
            episode_number: episode.episode_number,
            name: episode.name,
            air_date: episode.air_date,
          },
        })
      }
    }

    return result
  }, [allowUnreleased, regularSeasons, tracking, tvShowId])

  const handleOpenConfirm = useCallback(() => {
    requireAuth(async () => {
      if (isLoadingEpisodes || progress !== null || isMutating) return

      setIsLoadingEpisodes(true)
      try {
        const episodesToMark = await loadMarkableEpisodes()

        if (episodesToMark.length === 0) {
          toast.info("You're all caught up — nothing left to mark.")
          return
        }

        setPendingEpisodes(episodesToMark)
        setShowConfirmDialog(true)
      } catch (error) {
        console.error("Failed to load episodes:", error)
        toast.error("Failed to load episodes. Please try again.")
      } finally {
        setIsLoadingEpisodes(false)
      }
    }, "Sign in to track your watch progress")
  }, [isLoadingEpisodes, isMutating, loadMarkableEpisodes, progress, requireAuth])

  const handleCancel = useCallback(() => {
    cancelTokenRef.current.isCancelled = true
    setIsCancelling(true)
  }, [])

  const handleConfirm = useCallback(async () => {
    setShowConfirmDialog(false)
    cancelTokenRef.current = { isCancelled: false }
    markedCountRef.current = 0
    setIsCancelling(false)
    setProgress({ current: 0, total: pendingEpisodes.length })

    try {
      await markEntireShowWatched({
        tvShowId,
        episodesToMark: pendingEpisodes,
        showMetadata: {
          tvShowName,
          posterPath,
        },
        showStats,
        // Caught up after a full mark — same as mobile.
        nextEpisode: null,
        bulkOptions: {
          batchSize: 10,
          delayMs: 300,
          isCancelled: () => cancelTokenRef.current.isCancelled,
          onProgress: (markedCount, totalCount) => {
            markedCountRef.current = markedCount
            setProgress({ current: markedCount, total: totalCount })
          },
        },
      })

      const wasCancelled = cancelTokenRef.current.isCancelled

      if (wasCancelled) {
        toast.info(
          `Cancelled — progress saved (${markedCountRef.current} of ${pendingEpisodes.length} episodes).`,
        )
      } else {
        toast.success(`Marked ${pendingEpisodes.length} episodes as watched.`)
      }

      if (!wasCancelled && preferences.autoAddToWatching) {
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
      setPendingEpisodes([])
    }
  }, [
    addToList,
    firstAirDate,
    markEntireShowWatched,
    pendingEpisodes,
    posterPath,
    preferences.autoAddToWatching,
    removeFromList,
    showStats,
    tvShowId,
    tvShowName,
    voteAverage,
  ])

  if (regularSeasons.length === 0) return null

  const isBusy = isLoadingEpisodes || progress !== null || isMutating

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleOpenConfirm}
        disabled={isBusy}
        data-testid="seasons-mark-all-button"
      >
        {isLoadingEpisodes ? (
          <>
            <HugeiconsIcon
              icon={Loading03Icon}
              className="size-4 animate-spin"
            />
            Loading…
          </>
        ) : (
          <>
            <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-4" />
            Mark all watched
          </>
        )}
      </Button>

      {/* Confirm Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark All Episodes Watched?</DialogTitle>
            <DialogDescription>
              {allowUnreleased
                ? `This will mark all ${pendingEpisodes.length} episodes across ${regularSeasons.length} season${regularSeasons.length === 1 ? "" : "s"} as watched, including unreleased episodes.`
                : `This will mark all ${pendingEpisodes.length} aired episodes across ${regularSeasons.length} season${regularSeasons.length === 1 ? "" : "s"} as watched.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleConfirm}>Mark All Watched</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Blocking progress modal (mobile LoadingModal parity) */}
      <Dialog open={progress !== null} onOpenChange={() => {}}>
        <DialogContent
          showCloseButton={false}
          data-testid="seasons-mark-all-progress"
        >
          <DialogHeader>
            <DialogTitle>
              {isCancelling ? "Cancelling…" : "Marking episodes…"}
            </DialogTitle>
            <DialogDescription data-testid="seasons-mark-all-progress-text">
              {`Marked ${progress?.current ?? 0} of ${progress?.total ?? 0} episodes.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isCancelling}
              data-testid="seasons-mark-all-cancel"
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
      />
    </>
  )
}
