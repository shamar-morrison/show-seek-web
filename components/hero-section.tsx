"use client"

import { useState, useEffect, useCallback } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import type { HeroMedia } from "@/types/tmdb"
import { PlayIcon, PlusSignIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "@/lib/utils"

/** Duration each slide is shown (in milliseconds) */
const SLIDE_DURATION = 5000

/** Animation duration (in milliseconds) */
const ANIMATION_DURATION = 800

interface HeroSectionProps {
  mediaList: HeroMedia[]
  onWatchTrailer?: (media: HeroMedia) => void
  isPaused?: boolean
}

/**
 * HeroSection Component
 * Cinematic hero carousel that cycles through trending media
 * with smooth fade animations between slides
 */
export function HeroSection({
  mediaList,
  onWatchTrailer,
  isPaused = false,
}: HeroSectionProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const [displayIndex, setDisplayIndex] = useState(0)
  const [resetKey, setResetKey] = useState(0) // Used to reset the auto-advance timer

  // Handle slide transition
  const goToNextSlide = useCallback(() => {
    if (mediaList.length <= 1) return

    setIsAnimating(true)

    // After fade out, update the display index
    setTimeout(() => {
      setDisplayIndex((prev) => (prev + 1) % mediaList.length)
      setCurrentIndex((prev) => (prev + 1) % mediaList.length)
      setIsAnimating(false)
    }, ANIMATION_DURATION / 2)
  }, [mediaList.length])

  // Auto-advance slides - pauses when trailer modal is open (isPaused prop)
  useEffect(() => {
    if (mediaList.length <= 1) return
    if (isPaused) return // Pause when trailer is playing

    const interval = setInterval(goToNextSlide, SLIDE_DURATION)
    return () => clearInterval(interval)
  }, [goToNextSlide, mediaList.length, resetKey, isPaused])

  // Fallback content if no media is available
  if (!mediaList || mediaList.length === 0) {
    return (
      <section className="relative flex min-h-screen items-center justify-center bg-linear-to-b from-gray-900 to-black">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white">Welcome to ShowSeek</h1>
          <p className="mt-4 text-lg text-gray-400">
            Discover your next favorite movie or TV show
          </p>
        </div>
      </section>
    )
  }

  const currentMedia = mediaList[displayIndex]

  return (
    <section className="relative min-h-screen w-full overflow-hidden">
      {/* Background Backdrop Images - All loaded for smooth transitions */}
      {mediaList.map((media, index) => (
        <div
          key={media.id}
          className={cn(
            "absolute inset-0 transition-opacity duration-700 ease-in-out",
            index === displayIndex ? "opacity-100" : "opacity-0",
          )}
        >
          <Image
            src={media.backdropUrl}
            alt={media.title}
            fill
            priority={index === 0}
            className="object-cover object-center"
            sizes="100vw"
          />
        </div>
      ))}

      {/* Gradient Overlays */}
      {/* Top gradient for navbar contrast */}
      <div className="absolute inset-x-0 top-0 z-10 h-32 bg-linear-to-b from-black/70 to-transparent" />

      {/* Bottom gradient for content contrast */}
      <div className="absolute inset-0 z-10 bg-linear-to-t from-black via-black/60 to-transparent" />

      {/* Side gradient for text readability */}
      <div className="absolute inset-0 z-10 bg-linear-to-r from-black/80 via-black/30 to-transparent" />

      {/* Content */}
      <div className="relative z-20 flex min-h-screen items-end pb-24 pt-32">
        <div className="mx-auto w-full max-w-[1800px] px-4 sm:px-8 lg:px-12">
          <div
            className={cn(
              "max-w-2xl transition-all duration-500 ease-out",
              isAnimating
                ? "translate-y-4 opacity-0"
                : "translate-y-0 opacity-100",
            )}
          >
            {/* Logo or Title */}
            {currentMedia.logoUrl ? (
              <div className="mb-6">
                <Image
                  src={currentMedia.logoUrl}
                  alt={`${currentMedia.title} logo`}
                  width={350}
                  height={150}
                  className="h-auto max-h-32 w-auto max-w-xs object-contain drop-shadow-2xl sm:max-h-40 sm:max-w-sm lg:max-h-48 lg:max-w-md"
                  priority
                />
              </div>
            ) : (
              <h1 className="mb-6 text-4xl font-bold tracking-tight text-white drop-shadow-lg sm:text-5xl lg:text-6xl">
                {currentMedia.title}
              </h1>
            )}

            {/* Metadata Badges */}
            <div className="mb-4 flex flex-wrap items-center gap-3">
              {currentMedia.releaseYear && (
                <span className="rounded-md bg-white/10 px-2.5 py-1 text-sm font-medium text-gray-300 backdrop-blur-sm">
                  {currentMedia.releaseYear}
                </span>
              )}
              <span className="rounded-md bg-white/10 px-2.5 py-1 text-sm font-medium uppercase text-gray-300 backdrop-blur-sm">
                {currentMedia.mediaType === "movie" ? "Movie" : "TV Series"}
              </span>
              {currentMedia.voteAverage > 0 && (
                <span className="flex items-center gap-1 rounded-md bg-yellow-500/20 px-2.5 py-1 text-sm font-medium text-yellow-400 backdrop-blur-sm">
                  <span className="text-yellow-500">★</span>
                  {currentMedia.voteAverage}
                </span>
              )}
            </div>

            {/* Overview/Description */}
            <p className="mb-8 line-clamp-3 text-base leading-relaxed text-gray-300 sm:text-lg">
              {currentMedia.overview}
            </p>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3">
              <Button
                size="lg"
                className="group bg-primary px-6 font-semibold text-white shadow-lg shadow-primary/30 transition-all hover:bg-[#B20710] hover:shadow-primary/50"
                onClick={() => {
                  if (currentMedia.trailerKey && onWatchTrailer) {
                    onWatchTrailer(currentMedia)
                  }
                }}
                disabled={!currentMedia.trailerKey}
              >
                <HugeiconsIcon
                  icon={PlayIcon}
                  className="size-5 transition-transform group-hover:scale-110"
                />
                Watch Trailer
              </Button>

              {/* Add to List Button - Secondary/Outline */}
              <Button
                size="lg"
                variant="outline"
                className="border-white/20 bg-white/5 px-6 font-semibold text-white backdrop-blur-sm transition-all hover:border-white/40 hover:bg-white/10"
              >
                <HugeiconsIcon icon={PlusSignIcon} className="size-5" />
                Add to List
              </Button>
            </div>
          </div>

          {/* Slide Indicators - Centered */}
          {mediaList.length > 1 && (
            <div className="absolute inset-x-0 bottom-8 flex justify-center">
              <div className="flex items-center gap-2">
                {mediaList.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      if (index !== currentIndex && !isAnimating) {
                        setIsAnimating(true)
                        // Reset the auto-advance timer
                        setResetKey((prev) => prev + 1)
                        setTimeout(() => {
                          setDisplayIndex(index)
                          setCurrentIndex(index)
                          setIsAnimating(false)
                        }, ANIMATION_DURATION / 2)
                      }
                    }}
                    className={cn(
                      "h-1.5 rounded-full transition-all duration-300",
                      index === currentIndex
                        ? "w-8 bg-primary"
                        : "w-4 bg-white/30 hover:bg-white/50",
                    )}
                    aria-label={`Go to slide ${index + 1}`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Trailer Modal */}
    </section>
  )
}
