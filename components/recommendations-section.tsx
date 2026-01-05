"use client"

import { fetchRecommendations } from "@/app/actions"
import { MediaRow } from "@/components/media-row"
import { TrailerModal } from "@/components/trailer-modal"
import { SectionSkeleton } from "@/components/ui/section-skeleton"
import { useIntersectionObserver } from "@/hooks/use-intersection-observer"
import { useTrailer } from "@/hooks/use-trailer"
import type { TMDBMedia } from "@/types/tmdb"
import { useCallback, useState } from "react"

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
  const [recommendations, setRecommendations] = useState<TMDBMedia[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)

  // Trailer hook for modal state
  const { isOpen, activeTrailer, loadingMediaId, watchTrailer, closeTrailer } =
    useTrailer()

  const loadRecommendations = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await fetchRecommendations(mediaId, mediaType)
      setRecommendations(data || [])
    } catch (error) {
      console.error("Failed to load recommendations:", error)
    } finally {
      setIsLoading(false)
      setHasLoaded(true)
    }
  }, [mediaId, mediaType])

  // Lazy load when section comes into view
  const { ref: sectionRef } =
    useIntersectionObserver<HTMLDivElement>(loadRecommendations)

  // Handle trailer playback
  const handleWatchTrailer = (media: TMDBMedia) => {
    watchTrailer(media.id, mediaType, media.title || media.name || "Trailer")
  }

  // Don't render section if loaded and no recommendations
  if (hasLoaded && recommendations.length === 0) return null

  return (
    <div ref={sectionRef as React.RefObject<HTMLDivElement>}>
      {isLoading || !hasLoaded ? (
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
