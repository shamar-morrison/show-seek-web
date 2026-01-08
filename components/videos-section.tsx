"use client"

import { TrailerModal } from "@/components/trailer-modal"
import { SectionSkeleton } from "@/components/ui/section-skeleton"
import { useIntersectionObserver } from "@/hooks/use-intersection-observer"
import { useMediaVideos } from "@/hooks/use-tmdb-queries"
import type { TMDBVideo } from "@/types/tmdb"
import { PlayIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useMemo, useRef, useState } from "react"

interface VideosSectionProps {
  /** TMDB media ID */
  mediaId: number
  /** Media type */
  mediaType: "movie" | "tv"
}

const INITIAL_LIMIT = 10

/**
 * Get YouTube thumbnail URL for a video
 */
function getYouTubeThumbnail(videoKey: string): string {
  return `https://img.youtube.com/vi/${videoKey}/mqdefault.jpg`
}

/**
 * VideosSection Component
 * Lazily loads and displays videos when scrolled into view
 */
export function VideosSection({ mediaId, mediaType }: VideosSectionProps) {
  const [showAll, setShowAll] = useState(false)
  const [activeVideo, setActiveVideo] = useState<TMDBVideo | null>(null)
  const hasTriggered = useRef(false)
  const [shouldFetch, setShouldFetch] = useState(false)

  // Use intersection observer to trigger fetch
  const { ref: sectionRef } = useIntersectionObserver<HTMLElement>(() => {
    if (!hasTriggered.current) {
      hasTriggered.current = true
      setShouldFetch(true)
    }
  })

  // React Query for videos
  const {
    data: rawVideos = [],
    isLoading,
    isFetched,
  } = useMediaVideos(mediaId, mediaType, shouldFetch)

  // Filter to YouTube videos only
  const videos = useMemo(
    () => rawVideos.filter((v) => v.site === "YouTube" && v.key),
    [rawVideos],
  )

  // Determine which videos to display
  const displayVideos = showAll ? videos : videos.slice(0, INITIAL_LIMIT)
  const hasMore = videos.length > INITIAL_LIMIT && !showAll

  // Don't render section if loaded and no videos
  if (isFetched && videos.length === 0) return null

  return (
    <section ref={sectionRef as React.RefObject<HTMLElement>} className="py-8">
      {/* Header */}
      <div className="mx-auto mb-4 flex max-w-[1800px] items-end justify-between px-4 sm:px-8 lg:px-12">
        <h2 className="text-xl font-bold text-white sm:text-2xl">Videos</h2>
        {isFetched && videos.length > 0 && (
          <span className="text-sm text-gray-400">
            {showAll
              ? videos.length
              : `${Math.min(videos.length, INITIAL_LIMIT)} of ${videos.length}`}{" "}
            videos
          </span>
        )}
      </div>

      {/* Content */}
      <div className="mx-auto max-w-[1800px] px-4 sm:px-8 lg:px-12">
        {isLoading || !isFetched ? (
          <SectionSkeleton count={6} cardWidth={200} cardHeight={120} />
        ) : (
          /* Video Grid */
          <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2">
            {displayVideos.map((video) => (
              <button
                key={video.id}
                onClick={() => setActiveVideo(video)}
                className="group shrink-0 text-left"
              >
                {/* Thumbnail Container */}
                <div className="relative overflow-hidden rounded-lg">
                  {/* Thumbnail */}
                  <img
                    src={getYouTubeThumbnail(video.key)}
                    alt={video.name}
                    className="h-[120px] w-[200px] object-cover sm:h-[140px] sm:w-[240px]"
                    loading="lazy"
                  />

                  {/* Play overlay - hidden by default, visible on hover */}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100">
                    <div className="rounded-full bg-white/90 p-3 transition-transform group-hover:scale-110">
                      <HugeiconsIcon
                        icon={PlayIcon}
                        className="size-6 text-black"
                      />
                    </div>
                  </div>
                </div>

                {/* Video info - below thumbnail */}
                <div className="mt-2 w-[200px] sm:w-[240px]">
                  <p className="line-clamp-1 text-sm font-medium text-white">
                    {video.name}
                  </p>
                  <span className="text-xs text-gray-400">{video.type}</span>
                </div>
              </button>
            ))}

            {/* View All Button */}
            {hasMore && (
              <button
                onClick={() => setShowAll(true)}
                className="flex h-[120px] w-[120px] shrink-0 flex-col items-center justify-center gap-2 rounded-lg bg-gray-800 text-white transition-colors hover:bg-gray-700 sm:h-[140px] sm:w-[140px]"
              >
                <span className="text-2xl font-bold">
                  +{videos.length - INITIAL_LIMIT}
                </span>
                <span className="text-xs text-gray-400">View all</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Video Modal */}
      <TrailerModal
        videoKey={activeVideo?.key || null}
        isOpen={activeVideo !== null}
        onClose={() => setActiveVideo(null)}
        title={activeVideo?.name || "Video"}
      />
    </section>
  )
}
