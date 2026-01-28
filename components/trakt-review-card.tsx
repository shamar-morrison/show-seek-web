"use client"

import type { TraktComment } from "@/types/trakt"
import { Alert02Icon, StarIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

interface TraktReviewCardProps {
  /** Trakt review/comment data */
  review: TraktComment
  /** Click handler to open full review modal */
  onClick: () => void
}

/**
 * TraktReviewCard Component
 * Displays a Trakt review card with user info and truncated content
 */
export function TraktReviewCard({ review, onClick }: TraktReviewCardProps) {
  const hasRating = review.user_rating !== null
  const avatarUrl = review.user.avatar?.full

  return (
    <button
      type="button"
      onClick={onClick}
      className="group block shrink-0 text-left"
    >
      <div className="w-72 overflow-hidden rounded-xl bg-card shadow-md transition-all duration-300 hover:bg-card/80 cursor-pointer sm:w-80">
        {/* Header with user info */}
        <div className="flex items-center gap-3 p-4 pb-3">
          {/* Profile Image */}
          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gray-800">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={review.user.username}
                className="absolute inset-0 h-full w-full object-cover"
                sizes="40px"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gray-700 text-gray-400 text-sm font-medium">
                {review.user.username.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          {/* Username and rating */}
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="line-clamp-1 text-sm font-semibold text-white">
              {review.user.name || review.user.username}
            </span>
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

          {/* Spoiler indicator */}
          {review.spoiler && (
            <div className="ml-auto flex items-center gap-1 text-xs text-orange-400">
              <HugeiconsIcon icon={Alert02Icon} className="size-3" />
              <span>Spoiler</span>
            </div>
          )}
        </div>

        {/* Review content snippet - 3 lines */}
        <div className="px-4 pb-4">
          <p className="line-clamp-3 text-sm text-gray-300 leading-relaxed">
            {review.spoiler
              ? "Click to reveal spoiler content..."
              : review.comment}
          </p>
        </div>
      </div>
    </button>
  )
}
