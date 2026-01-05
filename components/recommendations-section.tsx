"use client"

import { fetchRecommendations, fetchTrailerKey } from "@/app/actions"
import { MediaRow } from "@/components/media-row"
import { TrailerModal } from "@/components/trailer-modal"
import type { TMDBMedia } from "@/types/tmdb"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

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
  const [isTrailerOpen, setIsTrailerOpen] = useState(false)
  const [activeTrailer, setActiveTrailer] = useState<{
    key: string
    title: string
  } | null>(null)
  const [loadingMediaId, setLoadingMediaId] = useState<number | null>(null)
  const sectionRef = useRef<HTMLDivElement>(null)

  // Lazy load recommendations when section comes into view
  useEffect(() => {
    if (hasLoaded) return

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        if (entry.isIntersecting && !hasLoaded && !isLoading) {
          loadRecommendations()
        }
      },
      {
        rootMargin: "200px",
        threshold: 0,
      },
    )

    if (sectionRef.current) {
      observer.observe(sectionRef.current)
    }

    return () => observer.disconnect()
  }, [hasLoaded, isLoading, mediaId, mediaType])

  const loadRecommendations = async () => {
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
  }

  // Handle trailer playback
  const handleWatchTrailer = async (media: TMDBMedia) => {
    const mediaTitle = media.title || media.name || "Trailer"
    setLoadingMediaId(media.id)

    try {
      const key = await fetchTrailerKey(media.id, mediaType)
      if (key) {
        setActiveTrailer({ key, title: mediaTitle })
        setIsTrailerOpen(true)
      } else {
        toast.error(`No trailer available for ${mediaTitle}`)
      }
    } catch (error) {
      console.error("Error fetching trailer:", error)
      toast.error("Failed to load trailer")
    } finally {
      setLoadingMediaId(null)
    }
  }

  // Don't render section if loaded and no recommendations
  if (hasLoaded && recommendations.length === 0) return null

  return (
    <div ref={sectionRef}>
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
        isOpen={isTrailerOpen}
        onClose={() => {
          setIsTrailerOpen(false)
          setActiveTrailer(null)
        }}
        title={activeTrailer?.title || "Trailer"}
      />
    </div>
  )
}
