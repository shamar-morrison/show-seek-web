"use client"

import { MediaCard } from "@/components/media-card"
import type { TMDBMedia } from "@/types/tmdb"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import Link from "next/link"

interface MediaRowProps {
  title: string
  items: TMDBMedia[]
  href?: string
  onWatchTrailer?: (media: TMDBMedia) => void
  onAddToList?: (media: TMDBMedia) => void
  loadingMediaId?: number | null
  /** If true, renders a horizontal scrollable row instead of a grid */
  scrollable?: boolean
  /** Maximum items to display (default: 7 for grid, all for scrollable) */
  limit?: number
}

export function MediaRow({
  title,
  items,
  href,
  onWatchTrailer,
  onAddToList,
  loadingMediaId,
  scrollable = false,
  limit,
}: MediaRowProps) {
  if (!items || items.length === 0) return null

  // Default limits: 7 for grid, all items for scrollable
  const displayLimit = limit ?? (scrollable ? items.length : 7)
  const displayItems = items.slice(0, displayLimit)

  return (
    <section className="py-8">
      {/* Header */}
      <div className="mx-auto mb-4 flex max-w-[1800px] items-end justify-between px-4 sm:px-8 lg:px-12">
        <h2 className="text-xl font-bold text-white sm:text-2xl">{title}</h2>
        {href && (
          <Link
            href={href}
            className="group flex items-center gap-1 text-sm font-medium text-gray-400 transition-colors hover:text-white"
          >
            View all
            <HugeiconsIcon
              icon={ArrowRight01Icon}
              className="size-4 transition-transform group-hover:translate-x-1"
            />
          </Link>
        )}
      </div>

      {/* Content Container */}
      <div className="mx-auto max-w-[1800px] px-4 sm:px-8 lg:px-12">
        {scrollable ? (
          /* Horizontal Scroll Layout */
          <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2">
            {displayItems.map((item) => (
              <div key={item.id} className="w-[140px] shrink-0 sm:w-[160px]">
                <MediaCard
                  media={item}
                  onWatchTrailer={onWatchTrailer}
                  isLoading={loadingMediaId === item.id}
                />
              </div>
            ))}
          </div>
        ) : (
          /* Grid Layout */
          <div className="grid grid-cols-2 gap-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7">
            {displayItems.map((item) => (
              <MediaCard
                key={item.id}
                media={item}
                onWatchTrailer={onWatchTrailer}
                isLoading={loadingMediaId === item.id}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
