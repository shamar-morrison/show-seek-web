"use client"

import { MediaCard } from "@/components/media-card"
import { MediaPreviewCardWrapper } from "@/components/media-preview-card-wrapper"
import { useMediaActions } from "@/hooks/use-media-actions"
import { usePreferences } from "@/hooks/use-preferences"
import type { TMDBActionableMedia, TMDBMedia } from "@/types/tmdb"

interface MediaCardWithActionsProps {
  media: TMDBActionableMedia
  onWatchTrailer?: (media: TMDBActionableMedia) => void
  isLoading?: boolean
  priority?: boolean
  buttonText?: string
  collectionContext?: {
    collectionId: number | null
  }
  isWatched?: boolean
  preferOriginalTitles?: boolean
  selectionMode?: boolean
  isSelected?: boolean
  onSelectToggle?: () => void
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
  collectionContext,
  isWatched = false,
  preferOriginalTitles,
  selectionMode = false,
  isSelected = false,
  onSelectToggle,
}: MediaCardWithActionsProps) {
  // Determine media type
  const mediaType = media.media_type

  // Get user preferences
  const { preferences } = usePreferences()
  const resolvedPreferOriginalTitles =
    preferOriginalTitles ?? preferences.showOriginalTitles

  // Use consolidated media actions hook
  const { dropdownItems, userRating, listIds, modals } = useMediaActions({
    media,
    mediaType,
    collectionId: collectionContext?.collectionId ?? null,
  })

  const cardContent = (
    <MediaCard
      media={media}
      onWatchTrailer={
        onWatchTrailer && !selectionMode
          ? (trailerMedia: TMDBMedia) => {
              if (
                trailerMedia.media_type === "movie" ||
                trailerMedia.media_type === "tv"
              ) {
                onWatchTrailer(trailerMedia as TMDBActionableMedia)
              }
            }
          : undefined
      }
      isLoading={isLoading}
      priority={priority}
      buttonText={buttonText}
      dropdownItems={selectionMode ? undefined : dropdownItems}
      userRating={userRating?.rating}
      listIds={listIds}
      isWatched={isWatched}
      preferOriginalTitles={resolvedPreferOriginalTitles}
      selectionMode={selectionMode}
      isSelected={isSelected}
      onSelectToggle={onSelectToggle}
    />
  )

  return (
    <>
      {preferences.showMediaPreviewCards && !selectionMode ? (
        <MediaPreviewCardWrapper
          media={media}
          mediaType={mediaType}
          onWatchTrailer={
            onWatchTrailer
              ? (trailerMedia: TMDBMedia) => {
                  if (
                    trailerMedia.media_type === "movie" ||
                    trailerMedia.media_type === "tv"
                  ) {
                    onWatchTrailer(trailerMedia as TMDBActionableMedia)
                  }
                }
              : undefined
          }
          isLoading={isLoading}
          priority={priority}
          buttonText={buttonText}
          dropdownItems={dropdownItems}
          userRating={userRating?.rating}
          listIds={listIds}
          collectionContext={collectionContext}
          isWatched={isWatched}
          preferOriginalTitles={resolvedPreferOriginalTitles}
        />
      ) : (
        cardContent
      )}

      {!selectionMode ? modals : null}
    </>
  )
}
