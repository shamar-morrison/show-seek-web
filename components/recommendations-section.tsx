"use client"

import { fetchRecommendations } from "@/app/actions"
import { MediaRow } from "@/components/media-row"
import { TrailerModal } from "@/components/trailer-modal"
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
        /* Loading Skeleton */
        <section className="py-8">
          <div className="mx-auto mb-4 max-w-[1800px] px-4 sm:px-8 lg:px-12">
            <div className="h-7 w-48 animate-pulse rounded bg-gray-800" />
          </div>
          <div className="mx-auto max-w-[1800px] px-4 sm:px-8 lg:px-12">
            <div className="flex gap-4 overflow-hidden">
              {Array.from({ length: 7 }).map((_, i) => (
                <div
                  key={i}
                  className="h-[280px] w-[160px] shrink-0 animate-pulse rounded-lg bg-gray-800"
                />
              ))}
            </div>
          </div>
        </section>
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
