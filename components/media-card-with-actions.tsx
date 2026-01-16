"use client"

import { MediaCard } from "@/components/media-card"
import { MediaPreviewCardWrapper } from "@/components/media-preview-card-wrapper"
import { useMediaActions } from "@/hooks/use-media-actions"
import { usePreferences } from "@/hooks/use-preferences"
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
 * Optionally wraps with hover preview card when preference is enabled.
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

  // Get user preferences
  const { preferences } = usePreferences()

  // Use consolidated media actions hook
  const { dropdownItems, userRating, listIds, modals } = useMediaActions({
    media,
    mediaType,
  })

  const cardContent = (
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
  )

  return (
    <>
      {preferences.showMediaPreviewCards ? (
        <MediaPreviewCardWrapper
          media={media}
          mediaType={mediaType}
          onWatchTrailer={onWatchTrailer}
          isLoading={isLoading}
          priority={priority}
          buttonText={buttonText}
          dropdownItems={dropdownItems}
          userRating={userRating?.rating}
          listIds={listIds}
        />
      ) : (
        cardContent
      )}

      {modals}
    </>
  )
}
