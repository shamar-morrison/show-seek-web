"use client"

import { Button } from "@/components/ui/button"
import { StarIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

interface RateButtonProps {
  /** Whether the user has rated this item */
  hasRating: boolean
  /** The user's rating value (if rated) */
  rating?: number
  /** Click handler */
  onClick: (e?: React.MouseEvent) => void
  /** Whether the button is disabled */
  disabled?: boolean
  /** Button size - defaults to lg */
  size?: "sm" | "lg"
}

/**
 * RateButton Component
 * Reusable rate button with consistent styling across the app
 * Shows rating value when rated, "Rate" when not
 */
export function RateButton({
  hasRating,
  rating,
  onClick,
  disabled = false,
  size = "lg",
}: RateButtonProps) {
  return (
    <Button
      size={size}
      variant="outline"
      onClick={onClick}
      disabled={disabled}
      className={
        hasRating
          ? `border-yellow-500/50 bg-yellow-500/20 ${size === "lg" ? "px-6" : ""} font-semibold backdrop-blur-sm transition-all hover:border-yellow-500 hover:bg-yellow-500/30`
          : `border-white/20 bg-white/5 ${size === "lg" ? "px-6" : ""} font-semibold text-white backdrop-blur-sm transition-all hover:border-white/40 hover:bg-white/10`
      }
    >
      <HugeiconsIcon
        icon={StarIcon}
        className={`${size === "lg" ? "size-5" : "size-3.5"} ${hasRating ? "fill-yellow-500 text-yellow-500" : ""}`}
      />
      {hasRating && rating ? `${rating}/10` : "Rate"}
    </Button>
  )
}
