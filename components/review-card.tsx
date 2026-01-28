"use client"

import { buildAvatarUrl } from "@/lib/tmdb"
import type { TMDBReview } from "@/types/tmdb"
import { StarIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

interface ReviewCardProps {
  /** Review data */
  review: TMDBReview
  /** Click handler to open full review modal */
  onClick: () => void
}

/**
 * ReviewCard Component
 * Displays a review card with author info and truncated content
 */
export function ReviewCard({ review, onClick }: ReviewCardProps) {
  const avatarUrl = buildAvatarUrl(review.author_details.avatar_path)
  const hasRating = review.author_details.rating !== null

  return (
    <button
      type="button"
      onClick={onClick}
      className="group block shrink-0 text-left"
    >
      <div className="w-72 overflow-hidden rounded-xl bg-card shadow-md transition-all duration-300 hover:bg-card/80 cursor-pointer sm:w-80">
        {/* Header with author info */}
        <div className="flex items-center gap-3 p-4 pb-3">
          {/* Profile Image */}
          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gray-800">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={review.author}
                className="absolute inset-0 h-full w-full object-cover"
                sizes="40px"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gray-700 text-gray-400 text-sm font-medium">
                {review.author.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          {/* Author name and rating */}
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="line-clamp-1 text-sm font-semibold text-white">
              {review.author}
            </span>
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

        {/* Review content snippet - 3 lines */}
        <div className="px-4 pb-4">
          <p className="line-clamp-3 text-sm text-gray-300 leading-relaxed">
            {review.content}
          </p>
        </div>
      </div>
    </button>
  )
}
