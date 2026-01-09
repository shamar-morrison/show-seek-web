"use client"

import { TrailerModal } from "@/components/trailer-modal"
import { PlayIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useState } from "react"

interface VideoCardProps {
  /** YouTube video key */
  videoKey: string
  /** Video title */
  title: string
  /** Optional subtitle (e.g., video type or media type) */
  subtitle?: string
  /** Optional click handler - if not provided, opens modal internally */
  onClick?: () => void
}

/**
 * Get YouTube thumbnail URL for a video
 */
function getYouTubeThumbnail(videoKey: string): string {
  return `https://img.youtube.com/vi/${videoKey}/mqdefault.jpg`
}

/**
 * Reusable video card component with YouTube thumbnail and modal
 * Used by VideosSection on detail pages and TrailerRow on home page
 */
export function VideoCard({
  videoKey,
  title,
  subtitle,
  onClick,
}: VideoCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)

  const handleClick = onClick ?? (() => setIsModalOpen(true))

  return (
    <>
      <button onClick={handleClick} className="group shrink-0 text-left">
        {/* Thumbnail Container */}
        <div className="relative overflow-hidden rounded-lg">
          {/* Thumbnail */}
          <img
            src={getYouTubeThumbnail(videoKey)}
            alt={title}
            className="h-[120px] w-[200px] object-cover sm:h-[140px] sm:w-[240px]"
            loading="lazy"
          />

          {/* Play overlay - hidden by default, visible on hover */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100">
            <div className="rounded-full bg-white/90 p-3 transition-transform group-hover:scale-110">
              <HugeiconsIcon icon={PlayIcon} className="size-6 text-black" />
            </div>
          </div>
        </div>

        {/* Video info - below thumbnail */}
        <div className="mt-2 w-[200px] sm:w-[240px]">
          <p className="line-clamp-1 text-sm font-medium text-white">{title}</p>
          {subtitle && (
            <span className="text-xs text-gray-400">{subtitle}</span>
          )}
        </div>
      </button>

      {/* Modal - only rendered if no custom onClick */}
      {!onClick && (
        <TrailerModal
          videoKey={videoKey}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={title}
        />
      )}
    </>
  )
}
