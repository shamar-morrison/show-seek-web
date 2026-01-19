"use client"

import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { PlayIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

interface WatchTrailerButtonProps {
  /** Whether a trailer is available */
  hasTrailer: boolean
  /** Click handler when trailer is available */
  onClick: () => void
  /** Optional custom label (defaults to "Watch Trailer") */
  label?: string
  /** Button size variant */
  size?: "default" | "sm" | "lg"
  /** Additional class names */
  className?: string
}

/**
 * WatchTrailerButton Component
 * A reusable button for watching trailers with tooltip support for disabled state.
 * Shows "Trailer not available" tooltip when no trailer exists.
 */
export function WatchTrailerButton({
  hasTrailer,
  onClick,
  label = "Watch Trailer",
  size = "lg",
  className,
}: WatchTrailerButtonProps) {
  if (!hasTrailer) {
    return (
      <Tooltip>
        <TooltipTrigger
          className={cn(
            "inline-flex cursor-not-allowed items-center gap-2 rounded-md bg-primary/50 font-semibold text-white/70 shadow-lg shadow-primary/30",
            size === "lg" && "h-10 px-6",
            size === "default" && "h-9 px-4",
            size === "sm" && "h-8 px-3 text-sm",
            className,
          )}
        >
          <HugeiconsIcon icon={PlayIcon} className="size-5" />
          {label}
        </TooltipTrigger>
        <TooltipContent>
          <p>Trailer not available</p>
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <Button
      size={size}
      className={cn(
        "group bg-primary px-6 font-semibold text-white shadow-lg shadow-primary/30 transition-all hover:bg-primary/90 hover:shadow-primary/50",
        className,
      )}
      onClick={onClick}
    >
      <HugeiconsIcon
        icon={PlayIcon}
        className="size-5 transition-transform group-hover:scale-110"
      />
      {label}
    </Button>
  )
}
