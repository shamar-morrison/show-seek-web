"use client"

import { ReviewCard } from "@/components/review-card"
import { ReviewModal } from "@/components/review-modal"
import { ScrollableRow } from "@/components/ui/scrollable-row"
import { useIntersectionObserver } from "@/hooks/use-intersection-observer"
import { useMediaReviews } from "@/hooks/use-tmdb-queries"
import type { TMDBReview } from "@/types/tmdb"
import { useRef, useState } from "react"

interface ReviewsSectionProps {
  /** TMDB media ID */
  mediaId: number
  /** Media type */
  mediaType: "movie" | "tv"
}

/**
 * ReviewsSection Component
 * Lazily loads and displays reviews when scrolled into view
 */
export function ReviewsSection({ mediaId, mediaType }: ReviewsSectionProps) {
  const hasTriggered = useRef(false)
  const [shouldFetch, setShouldFetch] = useState(false)

  // Modal state
  const [selectedReview, setSelectedReview] = useState<TMDBReview | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Use intersection observer to trigger fetch
  const { ref: sectionRef } = useIntersectionObserver<HTMLDivElement>(() => {
    if (!hasTriggered.current) {
      hasTriggered.current = true
      setShouldFetch(true)
    }
  })

  // React Query for reviews
  const {
    data: reviews = [],
    isLoading,
    isFetched,
  } = useMediaReviews(mediaId, mediaType, shouldFetch)

  // Handle review card click
  const handleReviewClick = (review: TMDBReview) => {
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
            <div className="h-7 w-32 animate-pulse rounded bg-gray-800" />
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
          {/* Section Header */}
          <div className="mx-auto mb-4 max-w-[1800px] px-4 sm:px-8 lg:px-12">
            <h2 className="text-xl font-bold text-white sm:text-2xl">
              Reviews
            </h2>
          </div>

          {/* Horizontally Scrollable Row */}
          <div className="mx-auto max-w-[1800px] px-4 sm:px-8 lg:px-12">
            <ScrollableRow>
              {reviews.map((review) => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  onClick={() => handleReviewClick(review)}
                />
              ))}
            </ScrollableRow>
          </div>
        </section>
      )}

      <ReviewModal
        review={selectedReview}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />
    </div>
  )
}
