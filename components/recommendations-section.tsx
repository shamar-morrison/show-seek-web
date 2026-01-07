"use client"

import { MediaRow } from "@/components/media-row"
import { TrailerModal } from "@/components/trailer-modal"
import { SectionSkeleton } from "@/components/ui/section-skeleton"
import { useIntersectionObserver } from "@/hooks/use-intersection-observer"
import { useRecommendations } from "@/hooks/use-tmdb-queries"
import { useTrailer } from "@/hooks/use-trailer"
import type { TMDBMedia } from "@/types/tmdb"
import { useRef, useState } from "react"

interface RecommendationsSectionProps {
  /** TMDB media ID */
  mediaId: number
  /** Media type */
  mediaType: "movie" | "tv"
}

/**
 * RecommendationsSection Component
 * Lazily loads and displays recommendations when scrolled into view
 */
export function RecommendationsSection({
  mediaId,
  mediaType,
}: RecommendationsSectionProps) {
  const hasTriggered = useRef(false)
  const [shouldFetch, setShouldFetch] = useState(false)

  // Trailer hook for modal state
  const { isOpen, activeTrailer, loadingMediaId, watchTrailer, closeTrailer } =
    useTrailer()

  // Use intersection observer to trigger fetch
  const { ref: sectionRef } = useIntersectionObserver<HTMLDivElement>(() => {
    if (!hasTriggered.current) {
      hasTriggered.current = true
      setShouldFetch(true)
    }
  })

  // React Query for recommendations
  const {
    data: recommendations = [],
    isLoading,
    isFetched,
  } = useRecommendations(mediaId, mediaType, shouldFetch)

  // Handle trailer playback
  const handleWatchTrailer = (media: TMDBMedia) => {
    watchTrailer(media.id, mediaType, media.title || media.name || "Trailer")
  }

  // Don't render section if loaded and no recommendations
  if (isFetched && recommendations.length === 0) return null

  return (
    <div ref={sectionRef as React.RefObject<HTMLDivElement>}>
      {isLoading || !isFetched ? (
        <SectionSkeleton
          count={7}
          cardWidth={160}
          cardHeight={280}
          withSectionWrapper
        />
      ) : (
        <MediaRow
          title="You may also like"
          items={recommendations}
          scrollable
          onWatchTrailer={handleWatchTrailer}
          loadingMediaId={loadingMediaId}
        />
      )}

      <TrailerModal
        videoKey={activeTrailer?.key || null}
        isOpen={isOpen}
        onClose={closeTrailer}
        title={activeTrailer?.title || "Trailer"}
      />
    </div>
  )
}
