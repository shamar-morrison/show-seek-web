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
import type { TMDBSeasonEpisode } from "@/types/tmdb"
import { Loading03Icon, StarIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useCallback, useEffect, useState } from "react"

interface EpisodeRatingModalProps {
  /** Whether the modal is open */
  isOpen: boolean
  /** Callback when modal should close */
  onClose: () => void
  /** The episode to rate */
  episode: TMDBSeasonEpisode
  /** TV Show ID */
  tvShowId: number
  /** TV Show name for display and storage */
  tvShowName: string
}

/**
 * EpisodeRatingModal Component
 * Modal for rating TV show episodes on a scale of 1-10 with interactive stars
 */
export function EpisodeRatingModal({
  isOpen,
  onClose,
  episode,
  tvShowId,
  tvShowName,
}: EpisodeRatingModalProps) {
  const { getEpisodeRating, saveEpisodeRating, removeEpisodeRating } =
    useRatings()
  const [selectedRating, setSelectedRating] = useState<number>(0)
  const [hoverRating, setHoverRating] = useState<number>(0)
  const [isSaving, setIsSaving] = useState(false)
  const [hasExistingRating, setHasExistingRating] = useState(false)

  // Load existing rating when modal opens
  useEffect(() => {
    if (isOpen) {
      const existingRating = getEpisodeRating(
        tvShowId,
        episode.season_number,
        episode.episode_number,
      )
      setSelectedRating(existingRating?.rating || 0)
      setHasExistingRating(!!existingRating)
      setHoverRating(0)
    }
  }, [
    isOpen,
    getEpisodeRating,
    tvShowId,
    episode.season_number,
    episode.episode_number,
  ])

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
      await saveEpisodeRating(
        tvShowId,
        episode.season_number,
        episode.episode_number,
        selectedRating,
        episode.name,
        tvShowName,
        episode.still_path,
        episode.air_date,
      )
      onClose()
    } catch (error) {
      console.error("Error saving episode rating:", error)
    } finally {
      setIsSaving(false)
    }
  }, [
    selectedRating,
    saveEpisodeRating,
    tvShowId,
    episode,
    tvShowName,
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
      await removeEpisodeRating(
        tvShowId,
        episode.season_number,
        episode.episode_number,
      )
      onClose()
    } catch (error) {
      console.error("Error clearing episode rating:", error)
    } finally {
      setIsSaving(false)
    }
  }, [
    removeEpisodeRating,
    tvShowId,
    episode.season_number,
    episode.episode_number,
    onClose,
  ])

  // Determine which rating to display (hover takes precedence)
  const displayRating = hoverRating || selectedRating

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Rate this Episode</DialogTitle>
          <DialogDescription>
            <span className="block text-primary">{tvShowName}</span>
            <span className="block mt-1">
              S{episode.season_number}:E{episode.episode_number} -{" "}
              {episode.name}
            </span>
          </DialogDescription>
        </DialogHeader>

        {/* Star Rating - 10 stars with half-star support */}
        <div className="py-6">
          <div
            className="flex items-center justify-center gap-0.5"
            onMouseLeave={handleMouseLeave}
          >
            {Array.from({ length: 10 }, (_, i) => {
              const starIndex = i + 1
              // Left half = x.5 rating (minimum 1), Right half = whole rating
              // Star 1: left=1, right=1 | Star 2: left=1.5, right=2 | Star 3: left=2.5, right=3 | etc.
              const halfValue = Math.max(1, starIndex - 0.5) // 1, 1.5, 2.5, 3.5, ..., 9.5
              const fullValue = starIndex // 1, 2, 3, ..., 10

              // Determine fill state based on displayRating
              const isFull = displayRating >= fullValue
              const isHalf =
                !isFull &&
                displayRating >= halfValue &&
                displayRating < fullValue

              return (
                <div key={starIndex} className="relative">
                  {/* Base empty star */}
                  <HugeiconsIcon
                    icon={StarIcon}
                    className="size-7 text-gray-600 transition-colors"
                  />

                  {/* Half-filled overlay (left side) */}
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

                  {/* Full-filled overlay */}
                  {isFull && (
                    <div className="absolute inset-0">
                      <HugeiconsIcon
                        icon={StarIcon}
                        className="size-7 fill-yellow-500 text-yellow-500"
                      />
                    </div>
                  )}

                  {/* Clickable left half (half rating) */}
                  <button
                    type="button"
                    className="absolute inset-0 w-1/2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-l-sm"
                    onClick={() => handleStarClick(halfValue)}
                    onMouseEnter={() => handleStarHover(halfValue)}
                    aria-label={`Rate ${halfValue} out of 10`}
                  />

                  {/* Clickable right half (full rating) */}
                  <button
                    type="button"
                    className="absolute inset-0 left-1/2 w-1/2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-r-sm"
                    onClick={() => handleStarClick(fullValue)}
                    onMouseEnter={() => handleStarHover(fullValue)}
                    aria-label={`Rate ${fullValue} out of 10`}
                  />
                </div>
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
