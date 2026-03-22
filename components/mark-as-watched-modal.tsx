"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { BaseMediaModal } from "@/components/ui/base-media-modal"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Calendar03Icon,
  Clock02Icon,
  Loading03Icon,
  PlayIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useCallback, useState } from "react"
import {
  formatTmdbDate,
  isTmdbDateOnOrBeforeToday,
  parseTmdbDate,
} from "@/lib/tmdb-date"

interface MarkAsWatchedModalProps {
  /** Whether the modal is open */
  isOpen: boolean
  /** Callback when modal should close */
  onClose: () => void
  /** Movie title for display */
  movieTitle: string
  /** Movie release date in YYYY-MM-DD format */
  releaseDate?: string | null
  /** Callback to mark as watched with selected date */
  onMarkAsWatched: (date: Date) => Promise<void>
}

/**
 * Check if a date string is valid and in the past
 */
function isValidPastDate(dateString?: string | null): boolean {
  if (!dateString) return false

  try {
    return isTmdbDateOnOrBeforeToday(dateString)
  } catch {
    return false
  }
}

/**
 * Format a date string to display format
 */
function formatDisplayDate(dateString: string): string {
  return formatTmdbDate(dateString)
}

/**
 * MarkAsWatchedModal Component
 * Modal for selecting when the user watched a movie
 */
export function MarkAsWatchedModal({
  isOpen,
  onClose,
  movieTitle,
  releaseDate,
  onMarkAsWatched,
}: MarkAsWatchedModalProps) {
  const [showCalendar, setShowCalendar] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(false)

  const canUseReleaseDate = isValidPastDate(releaseDate)

  // Reset state when modal closes
  const handleClose = useCallback(() => {
    setShowCalendar(false)
    setSelectedDate(undefined)
    setIsLoading(false)
    onClose()
  }, [onClose])

  // Handle "Right now" option
  const handleRightNow = useCallback(async () => {
    setIsLoading(true)
    try {
      await onMarkAsWatched(new Date())
      handleClose()
    } catch (error) {
      console.error("Error marking as watched:", error)
    } finally {
      setIsLoading(false)
    }
  }, [onMarkAsWatched, handleClose])

  // Handle "Release Date" option
  const handleReleaseDate = useCallback(async () => {
    if (!releaseDate) return
    setIsLoading(true)
    try {
      await onMarkAsWatched(parseTmdbDate(releaseDate))
      handleClose()
    } catch (error) {
      console.error("Error marking as watched:", error)
    } finally {
      setIsLoading(false)
    }
  }, [releaseDate, onMarkAsWatched, handleClose])

  // Handle custom date selection from calendar modal
  const handleSelectDate = useCallback(
    async (date: Date | undefined) => {
      if (!date) return
      setSelectedDate(date)
      setShowCalendar(false)
      setIsLoading(true)
      try {
        await onMarkAsWatched(date)
        handleClose()
      } catch (error) {
        console.error("Error marking as watched:", error)
      } finally {
        setIsLoading(false)
      }
    },
    [onMarkAsWatched, handleClose],
  )

  return (
    <>
      <BaseMediaModal
        isOpen={isOpen}
        onClose={handleClose}
        title="When did you watch this?"
        description={movieTitle}
      >
        <div className="flex flex-col gap-3 py-2">
          {/* Right now option */}
          <Button
            variant="outline"
            size="lg"
            className="justify-start gap-3"
            onClick={handleRightNow}
            disabled={isLoading}
          >
            {isLoading ? (
              <HugeiconsIcon
                icon={Loading03Icon}
                className="size-5 animate-spin"
              />
            ) : (
              <HugeiconsIcon icon={Clock02Icon} className="size-5" />
            )}
            Right now
          </Button>

          {/* Release date option (only if valid past date) */}
          {canUseReleaseDate && releaseDate && (
            <Button
              variant="outline"
              size="lg"
              className="justify-start gap-3"
              onClick={handleReleaseDate}
              disabled={isLoading}
            >
              <HugeiconsIcon icon={PlayIcon} className="size-5" />
              Release Date ({formatDisplayDate(releaseDate)})
            </Button>
          )}

          {/* Choose a date option */}
          <Button
            variant="outline"
            size="lg"
            className="justify-start gap-3"
            onClick={() => setShowCalendar(true)}
            disabled={isLoading}
          >
            <HugeiconsIcon icon={Calendar03Icon} className="size-5" />
            Choose a date
          </Button>
        </div>
      </BaseMediaModal>

      {/* Date picker dialog */}
      <Dialog open={showCalendar} onOpenChange={setShowCalendar}>
        <DialogContent className="sm:max-w-fit">
          <DialogHeader>
            <DialogTitle>Choose a date</DialogTitle>
          </DialogHeader>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleSelectDate}
            disabled={(date) => date > new Date()}
            captionLayout="dropdown"
            fromYear={1900}
            toYear={new Date().getFullYear()}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
