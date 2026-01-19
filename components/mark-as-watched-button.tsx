"use client"

import { Button } from "@/components/ui/button"
import { Loading03Icon, Tick02Icon, ViewIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

interface MarkAsWatchedButtonProps {
  /** Number of times the user has watched this movie */
  watchCount: number
  /** Click handler */
  onClick: (e?: React.MouseEvent) => void
  /** Whether the button is in loading state */
  isLoading?: boolean
  /** Whether the button is disabled */
  disabled?: boolean
  /** Button size - defaults to lg */
  size?: "sm" | "lg"
}

/**
 * MarkAsWatchedButton Component
 * Shows "Mark as Watched" when not watched, "Watched X time(s)" when watched
 * Uses green styling when watched, gray when not
 */
export function MarkAsWatchedButton({
  watchCount,
  onClick,
  isLoading = false,
  disabled = false,
  size = "lg",
}: MarkAsWatchedButtonProps) {
  const hasWatched = watchCount > 0

  // Format the label
  const label = hasWatched
    ? watchCount === 1
      ? "Watched 1 time"
      : `Watched ${watchCount} times`
    : "Mark as Watched"

  return (
    <Button
      size={size}
      variant="outline"
      onClick={onClick}
      disabled={disabled || isLoading}
      className={
        hasWatched
          ? `border-green-500/50 bg-green-500/20 ${size === "lg" ? "px-6" : ""} font-semibold backdrop-blur-sm transition-all hover:border-green-500 hover:bg-green-500/30`
          : `border-white/20 bg-white/5 ${size === "lg" ? "px-6" : ""} font-semibold text-white backdrop-blur-sm transition-all hover:border-white/40 hover:bg-white/10`
      }
    >
      {isLoading ? (
        <HugeiconsIcon
          icon={Loading03Icon}
          className={`${size === "lg" ? "size-5" : "size-3.5"} animate-spin`}
        />
      ) : (
        <HugeiconsIcon
          icon={hasWatched ? Tick02Icon : ViewIcon}
          className={`${size === "lg" ? "size-5" : "size-3.5"} ${hasWatched ? "text-green-500" : ""}`}
        />
      )}
      <span className={hasWatched ? "text-green-500" : ""}>{label}</span>
    </Button>
  )
}
