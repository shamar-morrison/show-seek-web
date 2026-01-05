"use client"

import { fetchReviews } from "@/app/actions"
import { ReviewCard } from "@/components/review-card"
import { ReviewModal } from "@/components/review-modal"
import { useIntersectionObserver } from "@/hooks/use-intersection-observer"
import type { TMDBReview } from "@/types/tmdb"
import { useCallback, useState } from "react"

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
  const [reviews, setReviews] = useState<TMDBReview[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)

  // Modal state
  const [selectedReview, setSelectedReview] = useState<TMDBReview | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const loadReviews = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await fetchReviews(mediaId, mediaType)
      setReviews(data?.results || [])
    } catch (error) {
      console.error("Failed to load reviews:", error)
    } finally {
      setIsLoading(false)
      setHasLoaded(true)
    }
  }, [mediaId, mediaType])

  // Lazy load when section comes into view
  const { ref: sectionRef } =
    useIntersectionObserver<HTMLDivElement>(loadReviews)

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
  if (hasLoaded && reviews.length === 0) return null

  return (
    <div ref={sectionRef as React.RefObject<HTMLDivElement>}>
      {isLoading || !hasLoaded ? (
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
            <div className="scrollbar-hide -mx-4 flex gap-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              {reviews.map((review) => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  onClick={() => handleReviewClick(review)}
                />
              ))}
            </div>
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
