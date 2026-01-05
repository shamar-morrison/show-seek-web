import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { buildAvatarUrl } from "@/lib/tmdb"
import type { TMDBReview } from "@/types/tmdb"
import { StarIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import Image from "next/image"

interface ReviewModalProps {
  /** Review to display */
  review: TMDBReview | null
  /** Whether modal is open */
  isOpen: boolean
  /** Close handler */
  onClose: () => void
}

/**
 * ReviewModal Component
 * Displays full review content in a modal with sticky header
 */
export function ReviewModal({ review, isOpen, onClose }: ReviewModalProps) {
  if (!review) return null

  const avatarUrl = buildAvatarUrl(review.author_details.avatar_path)
  const hasRating = review.author_details.rating !== null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] flex flex-col gap-0 p-0 sm:max-w-lg overflow-hidden">
        {/* Sticky Header */}
        <DialogHeader className="sticky top-0 z-10 bg-background px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            {/* Profile Image */}
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-gray-800">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt={review.author}
                  fill
                  className="object-cover"
                  sizes="48px"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gray-700 text-gray-400 text-lg font-medium">
                  {review.author.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            {/* Author name and rating */}
            <div className="flex flex-col gap-0.5 min-w-0">
              <DialogTitle className="line-clamp-1 text-base font-semibold">
                {review.author}
              </DialogTitle>
              {hasRating && (
                <span className="flex items-center gap-1 text-xs text-yellow-500">
                  <HugeiconsIcon
                    icon={StarIcon}
                    className="size-3 fill-yellow-500"
                  />
                  <span className="relative top-[0.9px]">
                    {review.author_details.rating}/10
                  </span>
                </span>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="prose prose-invert prose-sm max-w-none">
            {/* Preserve paragraph breaks from the review content */}
            {review.content.split("\n\n").map((paragraph, index) => (
              <p
                key={index}
                className="text-gray-300 leading-relaxed mb-4 last:mb-0"
              >
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
