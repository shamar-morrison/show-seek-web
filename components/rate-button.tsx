"use client"

import { Button } from "@/components/ui/button"
import { Loading03Icon, StarIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react"

interface RateButtonProps {
  /** Whether the user has rated this item */
  hasRating: boolean
  /** The user's rating value (if rated) */
  rating?: number
  /** Click handler */
  onClick: (e?: React.MouseEvent) => void
  /** Whether the button is disabled */
  disabled?: boolean
  /** Whether data is loading */
  isLoading?: boolean
  /** Button size - defaults to lg */
  size?: "sm" | "lg"
  /**
   * The ONLY celebration trigger. Increment to replay the pop + burst,
   * e.g. after a rating modal closes above the button. Rating changes
   * alone never animate: the async save (optimistic update included)
   * resolves at an unknowable time, typically while a modal still covers
   * the button.
   */
  celebrationSignal?: number
}

/**
 * RateButton Component
 * Reusable rate button with consistent styling across the app
 * Shows rating value when rated, "Rate" when not
 */
const BURST_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315]

export function RateButton({
  hasRating,
  rating,
  onClick,
  disabled = false,
  isLoading = false,
  size = "lg",
  celebrationSignal = 0,
}: RateButtonProps) {
  const [celebrationKey, setCelebrationKey] = useState(0)
  const [isCelebrating, setIsCelebrating] = useState(false)
  const prevSignalRef = useRef<number | undefined>(undefined)

  const celebrate = useCallback(() => {
    setCelebrationKey((key) => key + 1)
    setIsCelebrating(true)
  }, [])

  // Sole trigger: the parent bumps celebrationSignal once the rating
  // modal has closed and the button is visible again.
  useEffect(() => {
    if (prevSignalRef.current === undefined) {
      prevSignalRef.current = celebrationSignal
      return
    }

    if (celebrationSignal !== prevSignalRef.current) {
      prevSignalRef.current = celebrationSignal
      if (hasRating && !isLoading) {
        celebrate()
      }
    }
  }, [celebrationSignal, hasRating, isLoading, celebrate])

  useEffect(() => {
    if (!isCelebrating) return
    const timer = setTimeout(() => setIsCelebrating(false), 650)
    return () => clearTimeout(timer)
  }, [isCelebrating, celebrationKey])

  return (
    <Button
      size={size}
      variant="outline"
      onClick={onClick}
      disabled={disabled || isLoading}
      className={
        hasRating && !isLoading
          ? `border-yellow-500/50 bg-yellow-500/20 ${size === "lg" ? "px-6" : ""} font-semibold backdrop-blur-sm transition-all hover:border-yellow-500 hover:bg-yellow-500/30`
          : `border-white/20 bg-white/5 ${size === "lg" ? "px-6" : ""} font-semibold text-white backdrop-blur-sm transition-all hover:border-white/40 hover:bg-white/10`
      }
    >
      {isLoading ? (
        <HugeiconsIcon
          icon={Loading03Icon}
          className={`${size === "lg" ? "size-5" : "size-3.5"} animate-spin`}
        />
      ) : (
        <span className="relative inline-flex" aria-hidden={isCelebrating}>
          <HugeiconsIcon
            key={celebrationKey}
            icon={StarIcon}
            className={`${size === "lg" ? "size-5" : "size-3.5"} ${hasRating ? "fill-yellow-500 text-yellow-500" : ""} ${isCelebrating ? "animate-rate-star-pop" : ""}`}
          />
          {isCelebrating ? (
            <span key={`burst-${celebrationKey}`} className="absolute inset-0">
              {BURST_ANGLES.map((angle) => (
                <span
                  key={angle}
                  className="rate-burst-particle"
                  style={{ "--burst-angle": `${angle}deg` } as CSSProperties}
                />
              ))}
            </span>
          ) : null}
        </span>
      )}
      {isLoading ? "Loading..." : hasRating && rating ? `${rating}/10` : "Rate"}
    </Button>
  )
}
