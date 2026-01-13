"use client"

import { MediaCard } from "@/components/media-card"
import { useMediaActions } from "@/hooks/use-media-actions"
import type { TMDBMedia } from "@/types/tmdb"

interface MediaCardWithActionsProps {
  media: TMDBMedia
  onWatchTrailer?: (media: TMDBMedia) => void
  isLoading?: boolean
  priority?: boolean
  buttonText?: string
}

/**
 * MediaCard wrapper that adds dropdown actions for Add to List, Rate, and Notes.
 * Handles auth guard and modals internally via useMediaActions hook.
 */
export function MediaCardWithActions({
  media,
  onWatchTrailer,
  isLoading = false,
  priority = false,
  buttonText,
}: MediaCardWithActionsProps) {
  // Determine media type
  const mediaType = media.media_type === "movie" ? "movie" : "tv"

  // Use consolidated media actions hook
  const { dropdownItems, userRating, listIds, modals } = useMediaActions({
    media,
    mediaType,
  })

  return (
    <>
      <MediaCard
        media={media}
        onWatchTrailer={onWatchTrailer}
        isLoading={isLoading}
        priority={priority}
        buttonText={buttonText}
        dropdownItems={dropdownItems}
        userRating={userRating?.rating}
        listIds={listIds}
      />

      {modals}
    </>
  )
}
