"use client"

import { fetchTrailerKey } from "@/app/actions"
import { MediaRow } from "@/components/media-row"
import { TrailerModal } from "@/components/trailer-modal"
import type { TMDBMedia } from "@/types/tmdb"
import { useState } from "react"
import { toast } from "sonner"

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
  const [isTrailerOpen, setIsTrailerOpen] = useState(false)
  const [activeTrailer, setActiveTrailer] = useState<{
    key: string
    title: string
  } | null>(null)
  const [loadingMediaId, setLoadingMediaId] = useState<number | null>(null)

  // Handle opening trailer (fetch on demand)
  const handleWatchTrailer = async (media: TMDBMedia) => {
    const mediaTitle = media.title || media.name || "Trailer"

    setLoadingMediaId(media.id)

    try {
      const key = await fetchTrailerKey(media.id, mediaType)

      if (key) {
        setActiveTrailer({
          key,
          title: mediaTitle,
        })
        setIsTrailerOpen(true)
      } else {
        toast.error(`No trailer available for ${mediaTitle}`)
      }
    } catch (error) {
      console.error("Error fetching trailer:", error)
      toast.error("Failed to load trailer")
    } finally {
      setLoadingMediaId(null)
    }
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
        isOpen={isTrailerOpen}
        onClose={() => {
          setIsTrailerOpen(false)
          setActiveTrailer(null)
        }}
        title={activeTrailer?.title || "Trailer"}
      />
    </>
  )
}
