import { cn } from "@/lib/utils"
import { CrownIcon, StarIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import type { ReactNode } from "react"

interface BadgeProps {
  /** Badge content */
  children: ReactNode
  /** Badge variant */
  variant?: "default" | "rating" | "premium"
  /** Additional className */
  className?: string
}

/**
 * Badge Component
 * Glassmorphism metadata badge used in hero sections.
 * Supports a "rating" variant with star icon and yellow styling.
 */
export function Badge({
  children,
  variant = "default",
  className,
}: BadgeProps) {
  if (variant === "rating") {
    return (
      <span
        className={cn(
          "flex items-center gap-1 rounded-md bg-yellow-500/20 px-2.5 py-1 text-sm font-medium text-yellow-500 backdrop-blur-sm",
          className,
        )}
      >
        <HugeiconsIcon icon={StarIcon} className="size-3 fill-yellow-500" />
        {children}
      </span>
    )
  }

  if (variant === "premium") {
    return (
      <span
        className={cn(
          "flex items-center gap-1 rounded-md bg-amber-500/20 px-2.5 py-1 text-sm font-medium text-amber-400 backdrop-blur-sm",
          className,
        )}
      >
        <HugeiconsIcon icon={CrownIcon} className="size-3" />
        {children}
      </span>
    )
  }

  return (
    <span
      className={cn(
        "rounded-md bg-white/10 px-2.5 py-1 text-sm font-medium text-gray-300 backdrop-blur-sm",
        className,
      )}
    >
      {children}
    </span>
  )
}
