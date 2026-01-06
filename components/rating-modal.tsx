"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useRatings } from "@/hooks/use-ratings"
import type { TMDBMedia, TMDBMovieDetails, TMDBTVDetails } from "@/types/tmdb"
import { Loading03Icon, StarIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useCallback, useEffect, useState } from "react"

interface RatingModalProps {
  /** Whether the modal is open */
  isOpen: boolean
  /** Callback when modal should close */
  onClose: () => void
  /** The media item to rate */
  media: TMDBMedia | TMDBMovieDetails | TMDBTVDetails
  /** Media type */
  mediaType: "movie" | "tv"
}

/**
 * RatingModal Component
 * Modal for rating movies and TV shows on a scale of 1-10 with interactive stars
 */
export function RatingModal({
  isOpen,
  onClose,
  media,
  mediaType,
}: RatingModalProps) {
  const { getRating, saveRating, removeRating } = useRatings()
  const [selectedRating, setSelectedRating] = useState<number>(0)
  const [hoverRating, setHoverRating] = useState<number>(0)
  const [isSaving, setIsSaving] = useState(false)
  const [hasExistingRating, setHasExistingRating] = useState(false)

  const title: string =
    "title" in media && media.title
      ? media.title
      : "name" in media && media.name
        ? media.name
        : "Unknown"
  const mediaId = media.id
  const posterPath: string | null =
    "poster_path" in media ? (media.poster_path ?? null) : null

  // Load existing rating when modal opens
  useEffect(() => {
    if (isOpen) {
      const existingRating = getRating(mediaType, mediaId)
      setSelectedRating(existingRating?.rating || 0)
      setHasExistingRating(!!existingRating)
      setHoverRating(0)
    }
  }, [isOpen, getRating, mediaType, mediaId])

  const handleStarClick = useCallback((rating: number) => {
    setSelectedRating(rating)
  }, [])

  const handleStarHover = useCallback((rating: number) => {
    setHoverRating(rating)
  }, [])

  const handleMouseLeave = useCallback(() => {
    setHoverRating(0)
  }, [])

  const handleSave = useCallback(async () => {
    if (selectedRating === 0) return

    setIsSaving(true)
    try {
      await saveRating(mediaType, mediaId, selectedRating, title, posterPath)
      onClose()
    } catch (error) {
      console.error("Error saving rating:", error)
    } finally {
      setIsSaving(false)
    }
  }, [
    selectedRating,
    saveRating,
    mediaType,
    mediaId,
    title,
    posterPath,
    onClose,
  ])

  const handleClose = useCallback(() => {
    setSelectedRating(0)
    setHoverRating(0)
    onClose()
  }, [onClose])

  const handleClearRating = useCallback(async () => {
    setIsSaving(true)
    try {
      await removeRating(mediaType, mediaId)
      onClose()
    } catch (error) {
      console.error("Error clearing rating:", error)
    } finally {
      setIsSaving(false)
    }
  }, [removeRating, mediaType, mediaId, onClose])

  // Determine which rating to display (hover takes precedence)
  const displayRating = hoverRating || selectedRating

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">
            Rate this {mediaType === "movie" ? "Movie" : "Show"}
          </DialogTitle>
          <DialogDescription>
            How would you rate &quot;{title}&quot;?
          </DialogDescription>
        </DialogHeader>

        {/* Star Rating */}
        <div className="py-6">
          <div
            className="flex items-center justify-center gap-1"
            onMouseLeave={handleMouseLeave}
          >
            {Array.from({ length: 10 }, (_, i) => {
              const starValue = i + 1
              const isFilled = starValue <= displayRating

              return (
                <button
                  key={starValue}
                  type="button"
                  className="group p-1 transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm"
                  onClick={() => handleStarClick(starValue)}
                  onMouseEnter={() => handleStarHover(starValue)}
                  aria-label={`Rate ${starValue} out of 10`}
                >
                  <HugeiconsIcon
                    icon={StarIcon}
                    className={`size-7 transition-colors ${
                      isFilled
                        ? "fill-yellow-500 text-yellow-500"
                        : "text-gray-500 group-hover:text-yellow-500/50"
                    }`}
                  />
                </button>
              )
            })}
          </div>

          {/* Rating display */}
          <div className="mt-4 text-center">
            <span className="text-2xl font-bold text-white">
              {displayRating > 0 ? `${displayRating}/10` : "Select a rating"}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Button
            size={"lg"}
            onClick={handleSave}
            disabled={isSaving || selectedRating === 0}
          >
            {isSaving ? (
              <>
                <HugeiconsIcon
                  icon={Loading03Icon}
                  className="size-4 animate-spin"
                />
                Saving...
              </>
            ) : (
              "Save Rating"
            )}
          </Button>
          {hasExistingRating && (
            <Button
              size={"lg"}
              variant="secondary"
              onClick={handleClearRating}
              disabled={isSaving}
            >
              Clear Rating
            </Button>
          )}
          <Button
            size={"lg"}
            variant="outline"
            onClick={handleClose}
            disabled={isSaving}
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
