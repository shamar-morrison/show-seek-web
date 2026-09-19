"use client"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getMarkAsWatchedToneClassName } from "@/components/mark-as-watched-button"
import { useTVShowWatchAction } from "@/hooks/use-tv-show-watch-action"
import { cn } from "@/lib/utils"
import type { TMDBSeason } from "@/types/tmdb"
import {
  ArrowDown01Icon,
  Delete02Icon,
  Loading03Icon,
  Refresh01Icon,
  Tick02Icon,
  ViewIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

interface TVShowWatchButtonProps {
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
  /** Button size - defaults to lg (hero). Hover cards use sm. */
  size?: "sm" | "lg"
  /** Compact mode for hover cards: hides split dropdown, shrinks padding/icons */
  compact?: boolean
  /** Called before confirm/progress dialogs open (e.g. to close a hover preview) */
  onBeforeDialogOpen?: () => void
}

/**
 * Show-wide "Mark as Watched" / "Mark as Unwatched" hero button.
 * Ports mobile's `TVShowWatchButton`: excludes specials (S0), counts watched vs
 * markable episodes with the shared `getMarkableEpisodes` filter, writes in
 * chunks of 10 with a 300ms delay (cancellable, with progress), and exposes
 * "Clear watch history" through a split-button dropdown (mobile uses long-press)
 * that unmarks every tracked regular-season episode while preserving metadata.
 *
 * Logic lives in `useTVShowWatchAction` so hover preview cards can reuse the
 * trigger state while mounting the dialogs outside the preview popup.
 */
export function TVShowWatchButton({
  tvShowId,
  tvShowName,
  posterPath,
  seasons,
  showStats,
  voteAverage,
  firstAirDate,
  size = "lg",
  compact = false,
  onBeforeDialogOpen,
}: TVShowWatchButtonProps) {
  const action = useTVShowWatchAction({
    tvShowId,
    tvShowName,
    posterPath,
    seasons,
    showStats,
    voteAverage,
    firstAirDate,
  })

  const isCompact = compact || size === "sm"
  const iconClassName = size === "sm" ? "size-3.5" : "size-5"

  const handlePrimaryPress = () => {
    action.requestPrimaryAction(onBeforeDialogOpen)
  }

  if (action.isLoadingState) {
    return (
      <>
        <Button
          type="button"
          size={size}
          variant="outline"
          disabled
          data-testid="tv-show-watch-button-loading"
          className={cn(
            "border-white/20 bg-white/5 font-semibold text-white backdrop-blur-sm",
            size === "lg" && "px-6",
          )}
        >
          <HugeiconsIcon icon={Loading03Icon} className={cn(iconClassName, "animate-spin")} />
          <span>Loading…</span>
        </Button>
        {action.dialogs}
      </>
    )
  }

  // A failed season fetch must not read as a completed empty season.
  if (action.isEpisodesError) {
    return (
      <>
        <Button
          type="button"
          size={size}
          variant="outline"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            action.retryEpisodes()
          }}
          data-testid="tv-show-watch-button-retry"
          className={cn(
            "border-red-500/40 bg-red-500/10 font-semibold text-red-300 backdrop-blur-sm transition-all hover:border-red-500/60 hover:bg-red-500/20 hover:text-red-200",
            size === "lg" && "px-6",
          )}
        >
          <HugeiconsIcon icon={Refresh01Icon} className={iconClassName} />
          <span>Retry watch status</span>
        </Button>
        {action.dialogs}
      </>
    )
  }

  if (!action.shouldRender) return null

  return (
    <>
      <div
        className="flex items-stretch"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
      >
        <Button
          type="button"
          size={size}
          variant="outline"
          onClick={handlePrimaryPress}
          disabled={action.isPending}
          data-testid="tv-show-watch-button"
          className={cn(
            getMarkAsWatchedToneClassName(action.isShowFullyWatched),
            "relative overflow-hidden font-semibold backdrop-blur-sm transition-all",
            size === "lg" && "px-6",
            action.hasWatched && !isCompact && "rounded-r-none",
          )}
        >
          {action.fillRatio > 0 && (
            <span
              data-testid="tv-show-watch-fill"
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute inset-y-0 left-0 transition-[width] duration-300 ease-out",
                action.isShowFullyWatched ? "bg-green-500/30" : "bg-primary/30",
              )}
              style={{ width: `${action.fillRatio * 100}%` }}
            />
          )}
          {action.isPending ? (
            <HugeiconsIcon
              icon={Loading03Icon}
              className={cn("relative z-10 animate-spin", iconClassName)}
            />
          ) : (
            <HugeiconsIcon
              icon={action.isShowFullyWatched ? Tick02Icon : ViewIcon}
              className={cn(
                "relative z-10",
                iconClassName,
                action.isShowFullyWatched && "text-green-500",
              )}
            />
          )}
          <span
            className={cn(
              "relative z-10",
              action.isShowFullyWatched && "text-green-500",
            )}
          >
            {action.label}
          </span>
        </Button>

        {action.hasWatched && !isCompact && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  disabled={action.isPending}
                  aria-label="Watch history actions"
                  className={cn(
                    getMarkAsWatchedToneClassName(action.isShowFullyWatched),
                    "rounded-l-none border-l-0 px-3 font-semibold backdrop-blur-sm transition-all",
                  )}
                >
                  <HugeiconsIcon icon={ArrowDown01Icon} className="size-5" />
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="!w-56">
              <DropdownMenuItem
                variant="destructive"
                onClick={() => {
                  action.openClearConfirm(onBeforeDialogOpen)
                }}
              >
                <HugeiconsIcon icon={Delete02Icon} className="size-4" />
                Clear watch history
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {action.dialogs}
    </>
  )
}
