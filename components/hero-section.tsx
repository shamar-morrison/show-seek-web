import Image from "next/image"
import { Button } from "@/components/ui/button"
import type { HeroMedia } from "@/types/tmdb"
import { PlayIcon, PlusSignIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

interface HeroSectionProps {
  media: HeroMedia | null
}

/**
 * HeroSection Component
 * Cinematic hero banner with backdrop image, gradient overlay,
 * movie/show logo or title, description, and action buttons
 */
export function HeroSection({ media }: HeroSectionProps) {
  // Fallback content if no media is available
  if (!media) {
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

  return (
    <section className="relative min-h-screen w-full overflow-hidden">
      {/* Background Backdrop Image */}
      <div className="absolute inset-0">
        <Image
          src={media.backdropUrl}
          alt={media.title}
          fill
          priority
          className="object-cover object-center"
          sizes="100vw"
        />
      </div>

      {/* Gradient Overlays */}
      {/* Top gradient for navbar contrast */}
      <div className="absolute inset-x-0 top-0 h-32 bg-linear-to-b from-black/70 to-transparent" />

      {/* Bottom gradient for content contrast */}
      <div className="absolute inset-0 bg-linear-to-t from-black via-black/60 to-transparent" />

      {/* Side gradient for text readability */}
      <div className="absolute inset-0 bg-linear-to-r from-black/80 via-black/30 to-transparent" />

      {/* Content */}
      <div className="relative z-10 flex min-h-screen items-end pb-24 pt-32">
        <div className="mx-auto w-full max-w-[1800px] px-4 sm:px-8 lg:px-12">
          <div className="max-w-2xl animate-fade-in-up">
            {/* Logo or Title */}
            {media.logoUrl ? (
              <div className="mb-6">
                <Image
                  src={media.logoUrl}
                  alt={`${media.title} logo`}
                  width={350}
                  height={150}
                  className="h-auto max-h-32 w-auto max-w-xs object-contain drop-shadow-2xl sm:max-h-40 sm:max-w-sm lg:max-h-48 lg:max-w-md"
                  priority
                />
              </div>
            ) : (
              <h1 className="mb-6 text-4xl font-bold tracking-tight text-white drop-shadow-lg sm:text-5xl lg:text-6xl">
                {media.title}
              </h1>
            )}

            {/* Metadata Badges */}
            <div className="mb-4 flex flex-wrap items-center gap-3">
              {media.releaseYear && (
                <span className="rounded-md bg-white/10 px-2.5 py-1 text-sm font-medium text-gray-300 backdrop-blur-sm">
                  {media.releaseYear}
                </span>
              )}
              <span className="rounded-md bg-white/10 px-2.5 py-1 text-sm font-medium uppercase text-gray-300 backdrop-blur-sm">
                {media.mediaType === "movie" ? "Movie" : "TV Series"}
              </span>
              {media.voteAverage > 0 && (
                <span className="flex items-center gap-1 rounded-md bg-yellow-500/20 px-2.5 py-1 text-sm font-medium text-yellow-400 backdrop-blur-sm">
                  <span className="text-yellow-500">★</span>
                  {media.voteAverage}
                </span>
              )}
            </div>

            {/* Overview/Description */}
            <p className="mb-8 line-clamp-3 text-base leading-relaxed text-gray-300 sm:text-lg">
              {media.overview}
            </p>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3">
              <Button
                size="lg"
                className="group rounded-full bg-[#E50914] px-6 font-semibold text-white shadow-lg shadow-[#E50914]/30 transition-all hover:bg-[#B20710] hover:shadow-[#E50914]/50"
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
                className="rounded-full border-white/20 bg-white/5 px-6 font-semibold text-white backdrop-blur-sm transition-all hover:border-white/40 hover:bg-white/10"
              >
                <HugeiconsIcon icon={PlusSignIcon} className="size-5" />
                Add to List
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
