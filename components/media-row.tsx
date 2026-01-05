"use client"

import Link from "next/link"
import { MediaCard } from "@/components/media-card"
import type { TMDBMedia } from "@/types/tmdb"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

interface MediaRowProps {
  title: string
  items: TMDBMedia[]
  href?: string
  onWatchTrailer?: (media: TMDBMedia) => void
  onAddToList?: (media: TMDBMedia) => void
}

export function MediaRow({
  title,
  items,
  href = "#",
  onWatchTrailer,
  onAddToList,
}: MediaRowProps) {
  if (!items || items.length === 0) return null

  return (
    <section className="py-8">
      {/* Header */}
      <div className="mx-auto mb-4 flex max-w-[1800px] items-end justify-between px-4 sm:px-8 lg:px-12">
        <h2 className="text-xl font-bold text-white sm:text-2xl">{title}</h2>
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
      </div>

      {/* Grid Container */}
      <div className="mx-auto max-w-[1800px] px-4 sm:px-8 lg:px-12">
        <div className="grid grid-cols-2 gap-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7">
          {items.slice(0, 7).map((item) => (
            <MediaCard
              key={item.id}
              media={item}
              onWatchTrailer={onWatchTrailer}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
