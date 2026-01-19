"use client"

import { TraktReviewCard } from "@/components/trakt-review-card"
import { TraktReviewModal } from "@/components/trakt-review-modal"
import { ScrollableRow } from "@/components/ui/scrollable-row"
import { useIntersectionObserver } from "@/hooks/use-intersection-observer"
import { useTraktReviews } from "@/hooks/use-trakt-queries"
import type { TraktComment } from "@/types/trakt"
import Image from "next/image"
import { useRef, useState } from "react"

interface TraktReviewsSectionProps {
  /** TMDB media ID */
  mediaId: number
  /** Media type */
  mediaType: "movie" | "tv"
}

const INITIAL_LIMIT = 15

/**
 * TraktReviewsSection Component
 * Lazily loads and displays Trakt reviews when scrolled into view
 */
export function TraktReviewsSection({
  mediaId,
  mediaType,
}: TraktReviewsSectionProps) {
  const hasTriggered = useRef(false)
  const [shouldFetch, setShouldFetch] = useState(false)
  const [showAll, setShowAll] = useState(false)

  // Modal state
  const [selectedReview, setSelectedReview] = useState<TraktComment | null>(
    null,
  )
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Use intersection observer to trigger fetch
  const { ref: sectionRef } = useIntersectionObserver<HTMLDivElement>(() => {
    if (!hasTriggered.current) {
      hasTriggered.current = true
      setShouldFetch(true)
    }
  })

  // React Query for Trakt reviews
  const {
    data: reviews = [],
    isLoading,
    isFetched,
  } = useTraktReviews(mediaId, mediaType, shouldFetch)

  // Determine which reviews to display
  const displayReviews = showAll ? reviews : reviews.slice(0, INITIAL_LIMIT)
  const hasMore = reviews.length > INITIAL_LIMIT && !showAll

  // Handle review card click
  const handleReviewClick = (review: TraktComment) => {
    setSelectedReview(review)
    setIsModalOpen(true)
  }

  // Close modal
  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedReview(null)
  }

  // Don't render section if loaded and no reviews
  if (isFetched && reviews.length === 0) return null

  return (
    <div ref={sectionRef as React.RefObject<HTMLDivElement>}>
      {isLoading || !isFetched ? (
        /* Loading Skeleton */
        <section className="py-8">
          <div className="mx-auto mb-4 max-w-[1800px] px-4 sm:px-8 lg:px-12">
            <div className="h-7 w-40 animate-pulse rounded bg-gray-800" />
          </div>
          <div className="mx-auto max-w-[1800px] px-4 sm:px-8 lg:px-12">
            <div className="flex gap-4 overflow-hidden">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-[140px] w-[288px] shrink-0 animate-pulse rounded-xl bg-gray-800 sm:w-[320px]"
                />
              ))}
            </div>
          </div>
        </section>
      ) : (
        <section className="py-8">
          {/* Section Header with Trakt Logo */}
          <div className="mx-auto mb-4 flex max-w-[1800px] items-end justify-between px-4 sm:px-8 lg:px-12">
            <div className="flex items-center gap-2">
              <Image
                src="/trakt-logo.svg"
                alt="Trakt"
                width={24}
                height={24}
                className="h-6 w-6"
              />
              <h2 className="text-xl font-bold text-white sm:text-2xl">
                Trakt Reviews
              </h2>
            </div>
            {reviews.length > 0 && (
              <span className="text-sm text-gray-400">
                {showAll
                  ? reviews.length
                  : `${Math.min(reviews.length, INITIAL_LIMIT)} of ${reviews.length}`}{" "}
                reviews
              </span>
            )}
          </div>

          {/* Horizontally Scrollable Row */}
          <div className="mx-auto max-w-[1800px] px-4 sm:px-8 lg:px-12">
            <ScrollableRow>
              {displayReviews.map((review) => (
                <TraktReviewCard
                  key={review.id}
                  review={review}
                  onClick={() => handleReviewClick(review)}
                />
              ))}

              {/* Load More Button */}
              {hasMore && (
                <button
                  onClick={() => setShowAll(true)}
                  className="flex h-[140px] w-[120px] shrink-0 flex-col items-center justify-center gap-2 rounded-xl bg-gray-800 text-white transition-colors hover:bg-gray-700 sm:w-[140px]"
                >
                  <span className="text-2xl font-bold">
                    +{reviews.length - INITIAL_LIMIT}
                  </span>
                  <span className="text-xs text-gray-400">Load more</span>
                </button>
              )}
            </ScrollableRow>
          </div>
        </section>
      )}

      <TraktReviewModal
        review={selectedReview}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />
    </div>
  )
}
