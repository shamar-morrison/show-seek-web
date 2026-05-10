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
import type { TMDBSeasonDetails } from "@/types/tmdb"
import { Loading03Icon, StarIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

interface SeasonRatingModalProps {
  /** Whether the modal is open */
  isOpen: boolean
  /** Callback when modal should close */
  onClose: () => void
  /** The season to rate */
  season: TMDBSeasonDetails
  /** TV show id for the season */
  tvShowId: number
  /** TV show name for display and storage */
  tvShowName: string
  /** Optional preferred display title for the TV show */
  displayTvShowName?: string
  /** Fallback poster path when the season has none */
  fallbackPosterPath?: string | null
}

function getToastErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return `${fallback}: ${error.message}`
  }

  return fallback
}

/**
 * SeasonRatingModal Component
 * Modal for rating TV seasons on a scale of 1-10 with interactive stars.
 */
export function SeasonRatingModal({
  isOpen,
  onClose,
  season,
  tvShowId,
  tvShowName,
  displayTvShowName,
  fallbackPosterPath = null,
}: SeasonRatingModalProps) {
  const { getSeasonRating, saveSeasonRating, removeSeasonRating } =
    useRatings()
  const [selectedRating, setSelectedRating] = useState<number>(0)
  const [hoverRating, setHoverRating] = useState<number>(0)
  const [isSaving, setIsSaving] = useState(false)
  const [hasExistingRating, setHasExistingRating] = useState(false)

  useEffect(() => {
    if (isOpen) {
      const existingRating = getSeasonRating(tvShowId, season.season_number)
      setSelectedRating(existingRating?.rating || 0)
      setHasExistingRating(!!existingRating)
      setHoverRating(0)
    }
  }, [getSeasonRating, isOpen, season.season_number, tvShowId])

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
      await saveSeasonRating({
        tvShowId,
        seasonNumber: season.season_number,
        rating: selectedRating,
        seasonName: season.name,
        tvShowName,
        posterPath: season.poster_path ?? fallbackPosterPath,
        airDate: season.air_date ?? null,
      })
      onClose()
    } catch (error) {
      console.error("Error saving season rating:", error)
      toast.error(getToastErrorMessage(error, "Failed to save season rating"))
    } finally {
      setIsSaving(false)
    }
  }, [
    fallbackPosterPath,
    onClose,
    saveSeasonRating,
    season.air_date,
    season.name,
    season.poster_path,
    season.season_number,
    selectedRating,
    tvShowId,
    tvShowName,
  ])

  const handleClose = useCallback(() => {
    setSelectedRating(0)
    setHoverRating(0)
    onClose()
  }, [onClose])

  const handleClearRating = useCallback(async () => {
    setIsSaving(true)
    try {
      await removeSeasonRating(tvShowId, season.season_number)
      onClose()
    } catch (error) {
      console.error("Error clearing season rating:", error)
      toast.error(getToastErrorMessage(error, "Failed to clear season rating"))
    } finally {
      setIsSaving(false)
    }
  }, [onClose, removeSeasonRating, season.season_number, tvShowId])

  const displayRating = hoverRating || selectedRating
  const visibleTvShowName = displayTvShowName || tvShowName

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Rate this Season</DialogTitle>
          <DialogDescription>
            <span className="block text-primary">{visibleTvShowName}</span>
            <span className="mt-1 block">
              Season {season.season_number} - {season.name}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="py-6">
          <div
            className="flex items-center justify-center gap-0.5"
            onMouseLeave={handleMouseLeave}
          >
            {Array.from({ length: 10 }, (_, i) => {
              const starIndex = i + 1
              const halfValue = Math.max(1, starIndex - 0.5)
              const fullValue = starIndex
              const isFull = displayRating >= fullValue
              const isHalf =
                !isFull &&
                displayRating >= halfValue &&
                displayRating < fullValue

              return (
                <div key={starIndex} className="relative">
                  <HugeiconsIcon
                    icon={StarIcon}
                    className="size-7 text-gray-600 transition-colors"
                  />

                  {isHalf && (
                    <div
                      className="absolute inset-0 overflow-hidden"
                      style={{ clipPath: "inset(0 50% 0 0)" }}
                    >
                      <HugeiconsIcon
                        icon={StarIcon}
                        className="size-7 fill-yellow-500 text-yellow-500"
                      />
                    </div>
                  )}

                  {isFull && (
                    <div className="absolute inset-0">
                      <HugeiconsIcon
                        icon={StarIcon}
                        className="size-7 fill-yellow-500 text-yellow-500"
                      />
                    </div>
                  )}

                  <button
                    type="button"
                    className="absolute inset-0 w-1/2 rounded-l-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    onClick={() => handleStarClick(halfValue)}
                    onMouseEnter={() => handleStarHover(halfValue)}
                    aria-label={`Rate ${halfValue} out of 10`}
                  />

                  <button
                    type="button"
                    className="absolute inset-0 left-1/2 w-1/2 rounded-r-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    onClick={() => handleStarClick(fullValue)}
                    onMouseEnter={() => handleStarHover(fullValue)}
                    aria-label={`Rate ${fullValue} out of 10`}
                  />
                </div>
              )
            })}
          </div>

          <div className="mt-4 text-center">
            <span className="text-2xl font-bold text-white">
              {displayRating > 0 ? `${displayRating}/10` : "Select a rating"}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Button
            size="lg"
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
              size="lg"
              variant="secondary"
              onClick={handleClearRating}
              disabled={isSaving}
            >
              Clear Rating
            </Button>
          )}
          <Button
            size="lg"
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
