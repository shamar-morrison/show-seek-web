"use client"

import { MediaRow } from "@/components/media-row"
import { TrailerModal } from "@/components/trailer-modal"
import { useTrailer } from "@/hooks/use-trailer"
import type { TMDBMedia } from "@/types/tmdb"

interface SimilarMediaProps {
  /** Title for the section (e.g., "Similar Movies" or "Similar Shows") */
  title: string
  /** Array of similar media items */
  items: TMDBMedia[]
  /** Media type for fetching trailers */
  mediaType: "movie" | "tv"
}

/**
 * SimilarMedia Component
 * Client component that wraps MediaRow with trailer modal functionality
 * Used on detail pages to show similar movies/shows with working trailer buttons
 */
export function SimilarMedia({ title, items, mediaType }: SimilarMediaProps) {
  const { isOpen, activeTrailer, loadingMediaId, watchTrailer, closeTrailer } =
    useTrailer()

  const handleWatchTrailer = (media: TMDBMedia) => {
    watchTrailer(media.id, mediaType, media.title || media.name || "Trailer")
  }

  if (!items || items.length === 0) return null

  return (
    <>
      <MediaRow
        title={title}
        items={items}
        scrollable
        onWatchTrailer={handleWatchTrailer}
        loadingMediaId={loadingMediaId}
      />

      <TrailerModal
        videoKey={activeTrailer?.key || null}
        isOpen={isOpen}
        onClose={closeTrailer}
        title={activeTrailer?.title || "Trailer"}
      />
    </>
  )
}
