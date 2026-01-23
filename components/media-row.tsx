"use client"

import { MediaCard } from "@/components/media-card"
import { MediaCardWithActions } from "@/components/media-card-with-actions"
import { ScrollableRow } from "@/components/ui/scrollable-row"
import { Section } from "@/components/ui/section"
import { ViewAllLink } from "@/components/ui/view-all-link"
import { useContentFilter } from "@/hooks/use-content-filter"
import type { TMDBMedia } from "@/types/tmdb"

interface MediaRowProps {
  title: string
  items: TMDBMedia[]
  href?: string
  onWatchTrailer?: (media: TMDBMedia) => void
  loadingMediaId?: string | null
  /** If true, renders a horizontal scrollable row instead of a grid */
  scrollable?: boolean
  /** Maximum items to display (default: 7 for grid, all for scrollable) */
  limit?: number
  /** If true, shows dropdown actions (Add to List, Rate, Notes) on cards */
  showActions?: boolean
}

export function MediaRow({
  title,
  items,
  href,
  onWatchTrailer,
  loadingMediaId,
  scrollable = false,
  limit,
  showActions = false,
}: MediaRowProps) {
  // Filter out watched content
  const filteredItems = useContentFilter(items)

  if (!filteredItems) return null

  // Default limits: 7 for grid, all items for scrollable
  const displayLimit = limit ?? (scrollable ? filteredItems.length : 7)
  const displayItems = filteredItems.slice(0, displayLimit)

  // Choose which card component to render
  const CardComponent = showActions ? MediaCardWithActions : MediaCard

  return (
    <Section
      title={title}
      headerExtra={href ? <ViewAllLink href={href} /> : undefined}
    >
      {items.length === 0 ? (
        <div className="flex h-[200px] items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/5 text-gray-400">
          <p>No items in this list</p>
        </div>
      ) : scrollable ? (
        /* Horizontal Scroll Layout */
        <ScrollableRow className="pb-2">
          {displayItems.map((item) => (
            <div
              key={`${item.media_type}-${item.id}`}
              className="w-[140px] shrink-0 sm:w-[160px]"
            >
              <CardComponent
                media={item}
                onWatchTrailer={onWatchTrailer}
                isLoading={loadingMediaId === `${item.media_type}-${item.id}`}
              />
            </div>
          ))}
        </ScrollableRow>
      ) : (
        /* Grid Layout */
        <div className="grid grid-cols-2 gap-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7">
          {displayItems.map((item) => (
            <CardComponent
              key={`${item.media_type}-${item.id}`}
              media={item}
              onWatchTrailer={onWatchTrailer}
              isLoading={loadingMediaId === `${item.media_type}-${item.id}`}
            />
          ))}
        </div>
      )}
    </Section>
  )
}
