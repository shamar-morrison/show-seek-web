import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { TraktComment } from "@/types/trakt"
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  StarIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useCallback, useEffect, useRef } from "react"

interface TraktReviewModalProps {
  /** Reviews available for paging */
  reviews: TraktComment[]
  /** Index of the review to display */
  currentIndex: number
  /** Whether modal is open */
  isOpen: boolean
  /** Close handler */
  onClose: () => void
  /** Navigate handler */
  onNavigate: (index: number) => void
}

/**
 * TraktReviewModal Component
 * Displays full Trakt review content in a modal with sticky header.
 * Pages between reviews with on-screen chevrons or arrow keys.
 */
export function TraktReviewModal({
  reviews,
  currentIndex,
  isOpen,
  onClose,
  onNavigate,
}: TraktReviewModalProps) {
  const review = reviews[currentIndex] ?? null
  const hasPrev = currentIndex > 0
  const hasNext = currentIndex < reviews.length - 1
  const contentRef = useRef<HTMLDivElement>(null)

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      switch (event.key) {
        case "ArrowLeft":
          if (hasPrev) onNavigate(currentIndex - 1)
          break
        case "ArrowRight":
          if (hasNext) onNavigate(currentIndex + 1)
          break
      }
    },
    [onNavigate, currentIndex, hasPrev, hasNext],
  )

  useEffect(() => {
    if (!isOpen) return
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [isOpen, handleKeyDown])

  // Start each review at the top when paging.
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 })
  }, [isOpen, currentIndex])

  if (!review) return null

  const avatarUrl = review.user.avatar?.full
  const hasRating = review.user_rating !== null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] flex flex-col gap-0 p-0 sm:max-w-lg">
        {/* Sticky Header */}
        <DialogHeader className="sticky top-0 z-10 bg-background px-6 py-4 border-b border-white/10 rounded-t-xl">
          <div className="flex items-center gap-3">
            {/* Profile Image */}
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-gray-800">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={review.user.username}
                  className="absolute inset-0 h-full w-full object-cover"
                  sizes="48px"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gray-700 text-gray-400 text-lg font-medium">
                  {review.user.username.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            {/* Username and rating */}
            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
              <DialogTitle className="line-clamp-1 text-base font-semibold">
                {review.user.name || review.user.username}
              </DialogTitle>
              {hasRating && (
                <span className="flex items-center gap-1 text-xs text-yellow-500">
                  <HugeiconsIcon
                    icon={StarIcon}
                    className="size-3 fill-yellow-500"
                  />
                  <span className="relative top-[0.9px]">
                    {review.user_rating}/10
                  </span>
                </span>
              )}
            </div>

            {/* Position counter */}
            {reviews.length > 1 && (
              <span
                className="shrink-0 text-xs text-gray-400"
                aria-live="polite"
              >
                {currentIndex + 1} / {reviews.length}
              </span>
            )}
          </div>

          {/* Spoiler warning banner */}
          {review.spoiler && (
            <div className="mt-3 rounded-md bg-orange-500/10 px-3 py-2 text-sm text-orange-400">
              ⚠️ This review contains spoilers
            </div>
          )}
        </DialogHeader>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4" ref={contentRef}>
          <div className="prose prose-invert prose-sm max-w-none">
            {/* Preserve paragraph breaks from the review content */}
            {review.comment
              .split("\n\n")
              .filter((p) => p.trim())
              .map((paragraph, index) => (
                <p
                  key={index}
                  className="text-gray-300 leading-relaxed mb-4 last:mb-0"
                >
                  {paragraph}
                </p>
              ))}
          </div>
        </div>

      {/* Paging chevrons paint outside the panel via negative offsets
          (desktop only). They stay inside the dialog popup so assistive
          tech, focus trapping, and open/close animations keep working. */}
      {reviews.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => hasPrev && onNavigate(currentIndex - 1)}
            disabled={!hasPrev}
            className="absolute top-1/2 -left-14 hidden -translate-y-1/2 rounded-full bg-white/10 p-2.5 text-white transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-30 sm:block"
            aria-label="Previous review"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => hasNext && onNavigate(currentIndex + 1)}
            disabled={!hasNext}
            className="absolute top-1/2 -right-14 hidden -translate-y-1/2 rounded-full bg-white/10 p-2.5 text-white transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-30 sm:block"
            aria-label="Next review"
          >
            <HugeiconsIcon icon={ArrowRight01Icon} className="size-5" />
          </button>
        </>
      )}
      </DialogContent>
    </Dialog>
  )
}
