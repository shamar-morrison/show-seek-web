"use client"

import { PhotoLightbox } from "@/components/photo-lightbox"
import { ScrollableRow } from "@/components/ui/scrollable-row"
import { SectionSkeleton } from "@/components/ui/section-skeleton"
import { useIntersectionObserver } from "@/hooks/use-intersection-observer"
import { usePreferences } from "@/hooks/use-preferences"
import { useMediaImages } from "@/hooks/use-tmdb-queries"
import { getPosterLanguagesForRegion } from "@/lib/regions"
import { buildImageUrl } from "@/lib/tmdb"
import { useMemo, useRef, useState } from "react"

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
  const [showAll, setShowAll] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const hasTriggered = useRef(false)
  const [shouldFetch, setShouldFetch] = useState(false)

  // Use intersection observer to trigger fetch
  const { ref: sectionRef } = useIntersectionObserver<HTMLElement>(() => {
    if (!hasTriggered.current) {
      hasTriggered.current = true
      setShouldFetch(true)
    }
  })

  // React Query for images
  const {
    data: images = [],
    isLoading,
    isFetched,
  } = useMediaImages(mediaId, mediaType, shouldFetch)

  // Only show photos/backdrops matching the user's region language
  // (language-neutral images always pass), same as Change Poster.
  const { region } = usePreferences()
  const [showAllLanguages, setShowAllLanguages] = useState(false)
  const allowedLanguages = useMemo(
    () => new Set(getPosterLanguagesForRegion(region)),
    [region],
  )
  const visibleImages = useMemo(() => {
    if (showAllLanguages) return images
    return images.filter(
      (image) =>
        image.iso_639_1 === null || allowedLanguages.has(image.iso_639_1),
    )
  }, [images, allowedLanguages, showAllLanguages])
  const hiddenCount = images.length - visibleImages.length

  // Determine which images to display
  const displayImages = showAll
    ? visibleImages
    : visibleImages.slice(0, INITIAL_LIMIT)
  const hasMore = visibleImages.length > INITIAL_LIMIT && !showAll

  // Don't render section if loaded and no images
  if (isFetched && images.length === 0) return null

  return (
    <section ref={sectionRef as React.RefObject<HTMLElement>} className="py-8">
      {/* Header */}
      <div className="mx-auto mb-4 flex max-w-[1800px] items-end justify-between px-4 sm:px-8 lg:px-12">
        <h2 className="text-xl font-bold text-white sm:text-2xl">Photos</h2>
        {isFetched && images.length > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">
              {showAll
                ? visibleImages.length
                : `${Math.min(visibleImages.length, INITIAL_LIMIT)} of ${visibleImages.length}`}{" "}
              images
            </span>
            {(hiddenCount > 0 || showAllLanguages) && (
              <button
                type="button"
                onClick={() => setShowAllLanguages((value) => !value)}
                className="text-xs font-medium text-gray-400 transition-colors hover:text-white"
                data-testid={
                  showAllLanguages
                    ? "photos-show-matching"
                    : "photos-show-all"
                }
              >
                {showAllLanguages ? "Show matching only" : "Show all"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="mx-auto max-w-[1800px] px-4 sm:px-8 lg:px-12">
        {isLoading || !isFetched ? (
          <SectionSkeleton count={8} cardWidth={100} cardHeight={150} />
        ) : visibleImages.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center gap-3 py-8 text-center"
            data-testid="photos-region-empty"
          >
            <p className="text-sm text-gray-400">
              No photos available in your region language.
            </p>
            <button
              type="button"
              onClick={() => setShowAllLanguages(true)}
              className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20"
              data-testid="photos-show-all-empty"
            >
              Show all {images.length} photos
            </button>
          </div>
        ) : (
          /* Photo Grid */
          <ScrollableRow className="pb-2">
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
                  <img
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
                  +{visibleImages.length - INITIAL_LIMIT}
                </span>
                <span className="text-xs text-gray-400">View all</span>
              </button>
            )}
          </ScrollableRow>
        )}
      </div>

      {/* Lightbox - uses visible images for navigation, not just displayed */}
      <PhotoLightbox
        images={visibleImages}
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
