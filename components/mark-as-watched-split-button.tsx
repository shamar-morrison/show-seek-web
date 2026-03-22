"use client"

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
import { MarkAsWatchedButton, getMarkAsWatchedToneClassName } from "@/components/mark-as-watched-button"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { WatchHistoryDialog } from "@/components/watch-history-dialog"
import type { WatchInstance } from "@/lib/firebase/watched-movies"
import { cn } from "@/lib/utils"
import {
  ArrowDown01Icon,
  Delete02Icon,
  Loading03Icon,
  ViewIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useCallback, useMemo, useState } from "react"

interface MarkAsWatchedSplitButtonProps {
  watchCount: number
  movieTitle: string
  instances: WatchInstance[]
  isMarkAsWatchedLoading?: boolean
  isWatchHistoryLoading?: boolean
  disabled?: boolean
  size?: "sm" | "lg"
  onMarkAsWatched: (e?: React.MouseEvent) => void
  onClearWatchHistory: () => Promise<void>
  onDeleteWatch: (watchId: string) => Promise<void>
  onUpdateWatch: (watchId: string, watchedAt: Date) => Promise<void>
}

export function MarkAsWatchedSplitButton({
  watchCount,
  movieTitle,
  instances,
  isMarkAsWatchedLoading = false,
  isWatchHistoryLoading = false,
  disabled = false,
  size = "lg",
  onMarkAsWatched,
  onClearWatchHistory,
  onDeleteWatch,
  onUpdateWatch,
}: MarkAsWatchedSplitButtonProps) {
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false)
  const [isWatchHistoryOpen, setIsWatchHistoryOpen] = useState(false)
  const [isClearingHistory, setIsClearingHistory] = useState(false)

  const hasWatchHistory = watchCount > 0
  const iconClassName = size === "lg" ? "size-5" : "size-3.5"
  const secondaryButtonClassName = useMemo(
    () =>
      cn(
        getMarkAsWatchedToneClassName(hasWatchHistory),
        "rounded-l-none border-l-0 font-semibold backdrop-blur-sm transition-all",
        size === "lg" ? "px-3" : "px-2",
      ),
    [hasWatchHistory, size],
  )

  const handleClearWatchHistory = useCallback(async () => {
    setIsClearingHistory(true)
    try {
      await onClearWatchHistory()
      setIsClearConfirmOpen(false)
      setIsWatchHistoryOpen(false)
    } catch (error) {
      console.error("Error clearing watch history:", error)
    } finally {
      setIsClearingHistory(false)
    }
  }, [onClearWatchHistory])

  return (
    <>
      <div className="flex items-stretch">
        <MarkAsWatchedButton
          watchCount={watchCount}
          onClick={onMarkAsWatched}
          isLoading={isMarkAsWatchedLoading}
          disabled={disabled}
          size={size}
          className={hasWatchHistory ? "rounded-r-none" : undefined}
        />

        {hasWatchHistory && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="outline"
                  size={size}
                  className={secondaryButtonClassName}
                  disabled={disabled || isMarkAsWatchedLoading}
                  aria-label="Watch history actions"
                >
                  <HugeiconsIcon
                    icon={ArrowDown01Icon}
                    className={iconClassName}
                  />
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="!w-56">
              <DropdownMenuItem onClick={() => setIsWatchHistoryOpen(true)}>
                <HugeiconsIcon icon={ViewIcon} className="size-4" />
                View watch history
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setIsClearConfirmOpen(true)}
                variant="destructive"
              >
                <HugeiconsIcon icon={Delete02Icon} className="size-4" />
                Clear watch history
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <WatchHistoryDialog
        isOpen={isWatchHistoryOpen}
        onClose={() => setIsWatchHistoryOpen(false)}
        movieTitle={movieTitle}
        instances={instances}
        isLoading={isWatchHistoryLoading}
        onDeleteWatch={onDeleteWatch}
        onUpdateWatch={onUpdateWatch}
      />

      <AlertDialog
        open={isClearConfirmOpen}
        onOpenChange={setIsClearConfirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear watch history?</AlertDialogTitle>
            <AlertDialogDescription>
              Clear all watch history for this movie? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isClearingHistory}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearWatchHistory}
              disabled={isClearingHistory}
              className="bg-red-600 hover:bg-red-700"
            >
              {isClearingHistory ? (
                <>
                  <HugeiconsIcon
                    icon={Loading03Icon}
                    className="size-4 animate-spin"
                  />
                  Clearing...
                </>
              ) : (
                "Clear watch history"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
