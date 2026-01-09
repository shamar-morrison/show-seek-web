"use client"

import { TrailerModal } from "@/components/trailer-modal"
import type { TrailerItem } from "@/lib/tmdb"
import { buildImageUrl } from "@/lib/tmdb"
import { PlayIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import Image from "next/image"
import Link from "next/link"
import { useState } from "react"

interface TrailerCardProps {
  trailer: TrailerItem
}

export function TrailerCard({ trailer }: TrailerCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  const thumbnailUrl = `https://img.youtube.com/vi/${trailer.trailerKey}/hqdefault.jpg`
  const posterFallback = buildImageUrl(trailer.posterPath, "w342")
  const mediaUrl = `/${trailer.mediaType}/${trailer.id}`

  return (
    <>
      <div
        className="group relative shrink-0 w-[280px] snap-start"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Thumbnail Container */}
        <button
          onClick={() => setIsModalOpen(true)}
          className="relative aspect-video w-full overflow-hidden rounded-lg bg-white/5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <Image
            src={thumbnailUrl}
            alt={`${trailer.title} trailer`}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="280px"
          />

          {/* Dark overlay on hover */}
          <div
            className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${
              isHovered ? "opacity-100" : "opacity-0"
            }`}
          />

          {/* Play button */}
          <div
            className={`absolute inset-0 flex items-center justify-center transition-all duration-200 ${
              isHovered ? "opacity-100 scale-100" : "opacity-70 scale-90"
            }`}
          >
            <div className="flex size-14 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
              <HugeiconsIcon
                icon={PlayIcon}
                className="size-7 text-white ml-1"
                fill="white"
              />
            </div>
          </div>
        </button>

        {/* Title and Meta */}
        <div className="mt-2 space-y-1">
          <Link
            href={mediaUrl}
            className="line-clamp-1 text-sm font-medium text-white hover:text-primary transition-colors"
          >
            {trailer.title}
          </Link>
          <p className="text-xs text-white/50">
            {trailer.mediaType === "movie" ? "Movie" : "TV Show"}
            {trailer.releaseYear && ` • ${trailer.releaseYear}`}
          </p>
        </div>
      </div>

      <TrailerModal
        videoKey={trailer.trailerKey}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={trailer.title}
      />
    </>
  )
}
