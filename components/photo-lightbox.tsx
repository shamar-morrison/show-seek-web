"use client"

import { buildImageUrl } from "@/lib/tmdb"
import type { TMDBLogo } from "@/types/tmdb"
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

// Number of thumbnails to show on each side of current
const THUMBNAIL_WINDOW = 10

interface PhotoLightboxProps {
  /** Array of images to display */
  images: TMDBLogo[]
  /** Currently selected image index */
  currentIndex: number
  /** Whether the lightbox is open */
  isOpen: boolean
  /** Callback when the lightbox should close */
  onClose: () => void
  /** Callback when navigating to a different image */
  onNavigate: (index: number) => void
}

/**
 * PhotoLightbox Component
 * Fullscreen modal for viewing images with navigation
 */
export function PhotoLightbox({
  images,
  currentIndex,
  isOpen,
  onClose,
  onNavigate,
}: PhotoLightboxProps) {
  const currentImage = images[currentIndex]
  const hasPrev = currentIndex > 0
  const hasNext = currentIndex < images.length - 1
  const thumbnailContainerRef = useRef<HTMLDivElement>(null)
  const [loadedIndex, setLoadedIndex] = useState<number | null>(null)

  const isImageLoading = loadedIndex !== currentIndex

  // Reset loading state when closed
  useEffect(() => {
    if (!isOpen) setLoadedIndex(null)
  }, [isOpen])

  // Calculate visible thumbnail range (current ± THUMBNAIL_WINDOW)
  const visibleThumbnails = useMemo(() => {
    const start = Math.max(0, currentIndex - THUMBNAIL_WINDOW)
    const end = Math.min(images.length, currentIndex + THUMBNAIL_WINDOW + 1)
    return { start, end }
  }, [currentIndex, images.length])

  // Preload adjacent images
  useEffect(() => {
    if (!isOpen) return

    const preloadIndices = [
      currentIndex - 2,
      currentIndex - 1,
      currentIndex + 1,
      currentIndex + 2,
    ].filter((i) => i >= 0 && i < images.length)

    preloadIndices.forEach((index) => {
      const img = images[index]
      if (img) {
        const url = buildImageUrl(img.file_path, "w780")
        if (url) {
          const preloadImg = new window.Image()
          preloadImg.src = url
        }
      }
    })
  }, [isOpen, currentIndex, images])

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      switch (event.key) {
        case "Escape":
          onClose()
          break
        case "ArrowLeft":
          if (hasPrev) onNavigate(currentIndex - 1)
          break
        case "ArrowRight":
          if (hasNext) onNavigate(currentIndex + 1)
          break
      }
    },
    [onClose, onNavigate, currentIndex, hasPrev, hasNext],
  )

  // Add/remove event listeners
  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown)
      document.body.style.overflow = "hidden"
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      document.body.style.overflow = ""
    }
  }, [isOpen, handleKeyDown])

  // Scroll thumbnail into view when navigating
  useEffect(() => {
    if (!isOpen || !thumbnailContainerRef.current) return

    const container = thumbnailContainerRef.current
    const activeThumb = container.querySelector('[data-active="true"]')
    if (activeThumb) {
      activeThumb.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      })
    }
  }, [isOpen, currentIndex])

  if (!isOpen || !currentImage) return null

  // Use medium resolution (w780) for faster loading
  const imageUrl = buildImageUrl(currentImage.file_path, "w780")

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/95"
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <span className="text-sm text-gray-400">
          {currentIndex + 1} / {images.length}
        </span>
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-white/70 transition-colors hover:text-white"
          aria-label="Close"
        >
          <span className="text-sm font-medium">Close</span>
          <HugeiconsIcon icon={Cancel01Icon} className="size-6" />
        </button>
      </div>

      {/* Main Image Area */}
      <div className="relative flex flex-1 items-center justify-center px-16">
        {/* Previous Button */}
        <button
          onClick={() => hasPrev && onNavigate(currentIndex - 1)}
          disabled={!hasPrev}
          className="absolute left-4 z-10 rounded-full bg-white/10 p-3 text-white transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Previous image"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} className="size-6" />
        </button>

        {/* Image */}
        {imageUrl && (
          <div className="relative flex max-h-[70vh] max-w-full items-center justify-center">
            {isImageLoading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-white" />
              </div>
            )}
            <img
              key={imageUrl}
              src={imageUrl}
              alt={`Photo ${currentIndex + 1}`}
              width={currentImage.width}
              height={currentImage.height}
              className={`max-h-[70vh] w-auto object-contain transition-opacity duration-300 ${
                isImageLoading ? "opacity-0" : "opacity-100"
              }`}
              onLoad={() => setLoadedIndex(currentIndex)}
            />
          </div>
        )}

        {/* Next Button */}
        <button
          onClick={() => hasNext && onNavigate(currentIndex + 1)}
          disabled={!hasNext}
          className="absolute right-4 z-10 rounded-full bg-white/10 p-3 text-white transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Next image"
        >
          <HugeiconsIcon icon={ArrowRight01Icon} className="size-6" />
        </button>
      </div>

      {/* Thumbnail Strip - Only render visible range */}
      <div className="border-t border-white/10 p-4">
        <div
          ref={thumbnailContainerRef}
          className="mx-auto flex max-w-4xl items-center gap-2 overflow-x-auto scrollbar-hide"
        >
          {/* Show start indicator if truncated */}
          {visibleThumbnails.start > 0 && (
            <button
              onClick={() => onNavigate(0)}
              className="shrink-0 px-2 text-xs text-gray-500 hover:text-white"
            >
              ← 1
            </button>
          )}

          {images
            .slice(visibleThumbnails.start, visibleThumbnails.end)
            .map((image, i) => {
              const index = visibleThumbnails.start + i
              const thumbUrl = buildImageUrl(image.file_path, "w92")
              if (!thumbUrl) return null

              const isActive = index === currentIndex

              return (
                <button
                  key={index}
                  data-active={isActive}
                  onClick={() => onNavigate(index)}
                  className={`relative shrink-0 overflow-hidden rounded transition-all ${
                    isActive
                      ? "ring-2 ring-primary ring-offset-2 ring-offset-black"
                      : "opacity-50 hover:opacity-100"
                  }`}
                  aria-label={`Go to image ${index + 1}`}
                >
                  {/* Native img for performance */}
                  <img
                    src={thumbUrl}
                    alt={`Thumbnail ${index + 1}`}
                    className="h-[50px] w-auto object-cover"
                    loading="lazy"
                  />
                </button>
              )
            })}

          {/* Show end indicator if truncated */}
          {visibleThumbnails.end < images.length && (
            <button
              onClick={() => onNavigate(images.length - 1)}
              className="shrink-0 px-2 text-xs text-gray-500 hover:text-white"
            >
              {images.length} →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
