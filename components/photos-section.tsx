"use client"

import { fetchMediaImages } from "@/app/actions"
import { PhotoLightbox } from "@/components/photo-lightbox"
import { useIntersectionObserver } from "@/hooks/use-intersection-observer"
import { buildImageUrl } from "@/lib/tmdb"
import type { TMDBLogo } from "@/types/tmdb"
import Image from "next/image"
import { useCallback, useState } from "react"

interface PhotosSectionProps {
  /** TMDB media ID */
  mediaId: number
  /** Media type */
  mediaType: "movie" | "tv"
}

const INITIAL_LIMIT = 30

/**
 * PhotosSection Component
 * Lazily loads and displays photos (posters + backdrops) when scrolled into view
 */
export function PhotosSection({ mediaId, mediaType }: PhotosSectionProps) {
  const [images, setImages] = useState<TMDBLogo[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const loadImages = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await fetchMediaImages(mediaId, mediaType)
      if (data) {
        // Combine posters first, then backdrops
        const allImages = [...(data.posters || []), ...(data.backdrops || [])]
        setImages(allImages)
      }
    } catch (error) {
      console.error("Failed to load images:", error)
    } finally {
      setIsLoading(false)
      setHasLoaded(true)
    }
  }, [mediaId, mediaType])

  // Lazy load images when section comes into view
  const { ref: sectionRef } = useIntersectionObserver<HTMLElement>(loadImages)

  // Determine which images to display
  const displayImages = showAll ? images : images.slice(0, INITIAL_LIMIT)
  const hasMore = images.length > INITIAL_LIMIT && !showAll

  // Don't render section if loaded and no images
  if (hasLoaded && images.length === 0) return null

  return (
    <section ref={sectionRef as React.RefObject<HTMLElement>} className="py-8">
      {/* Header */}
      <div className="mx-auto mb-4 flex max-w-[1800px] items-end justify-between px-4 sm:px-8 lg:px-12">
        <h2 className="text-xl font-bold text-white sm:text-2xl">Photos</h2>
        {hasLoaded && images.length > 0 && (
          <span className="text-sm text-gray-400">
            {showAll
              ? images.length
              : `${Math.min(images.length, INITIAL_LIMIT)} of ${images.length}`}{" "}
            images
          </span>
        )}
      </div>

      {/* Content */}
      <div className="mx-auto max-w-[1800px] px-4 sm:px-8 lg:px-12">
        {isLoading || !hasLoaded ? (
          /* Loading Skeleton */
          <div className="flex gap-4 overflow-hidden">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-[150px] w-[100px] shrink-0 animate-pulse rounded-lg bg-gray-800 sm:h-[180px] sm:w-[120px]"
              />
            ))}
          </div>
        ) : (
          /* Photo Grid */
          <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2">
            {displayImages.map((image, index) => {
              const imageUrl = buildImageUrl(image.file_path, "w300")
              if (!imageUrl) return null

              // Calculate display dimensions based on aspect ratio
              const isLandscape = image.aspect_ratio > 1
              const height = isLandscape ? 100 : 150
              const width = Math.round(height * image.aspect_ratio)

              return (
                <button
                  key={index}
                  onClick={() => setLightboxIndex(index)}
                  className="group relative shrink-0 overflow-hidden rounded-lg transition-transform hover:opacity-80"
                >
                  <Image
                    src={imageUrl}
                    alt={`Photo ${index + 1}`}
                    width={width}
                    height={height}
                    className="h-[150px] w-auto object-cover sm:h-[180px]"
                  />
                  <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/20" />
                </button>
              )
            })}

            {/* View All Button */}
            {hasMore && (
              <button
                onClick={() => setShowAll(true)}
                className="flex h-[150px] w-[120px] shrink-0 flex-col items-center justify-center gap-2 rounded-lg bg-gray-800 text-white transition-colors hover:bg-gray-700 sm:h-[180px] sm:w-[140px]"
              >
                <span className="text-2xl font-bold">
                  +{images.length - INITIAL_LIMIT}
                </span>
                <span className="text-xs text-gray-400">View all</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Lightbox - uses all images for navigation, not just displayed */}
      <PhotoLightbox
        images={images}
        currentIndex={lightboxIndex ?? 0}
        isOpen={lightboxIndex !== null}
        onClose={() => setLightboxIndex(null)}
        onNavigate={(index) => {
          setLightboxIndex(index)
          // Auto-expand if navigating beyond initial limit
          if (index >= INITIAL_LIMIT) setShowAll(true)
        }}
      />
    </section>
  )
}
