"use client"

import { cn } from "@/lib/utils"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "./button"

interface FilterTabButtonProps {
  /** Label text for the tab */
  label: string
  /** Optional count to display in the badge */
  count?: number
  /** Whether this tab is currently active */
  isActive: boolean
  /** Optional icon component from @hugeicons/core-free-icons */
  icon?: Parameters<typeof HugeiconsIcon>[0]["icon"]
  /** Click handler */
  onClick: () => void
  /** Optional additional class names */
  className?: string
  /** Optional test id */
  testId?: string
}

/**
 * A reusable filter tab button with icon, label, and count badge.
 * Used for filtering content by category (e.g., Movies, TV Shows, Person).
 */
export function FilterTabButton({
  label,
  count,
  isActive,
  icon,
  onClick,
  className,
  testId,
}: FilterTabButtonProps) {
  return (
    <Button
      type="button"
      variant={isActive ? "default" : "ghost"}
      onClick={onClick}
      aria-pressed={isActive}
      data-testid={testId}
      className={cn(
        "shrink-0",
        icon ? "gap-2" : "gap-1.5",
        isActive
          ? "bg-primary text-white hover:bg-primary/90"
          : "text-gray-400 hover:bg-white/10 hover:text-white",
        className,
      )}
    >
      {icon ? <HugeiconsIcon icon={icon} className="size-4" /> : null}
      {label}
      {count !== undefined ? (
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-xs",
            icon ? "ml-1" : "",
            isActive ? "bg-white/20" : "bg-white/10 text-gray-500",
          )}
        >
          {count}
        </span>
      ) : null}
    </Button>
  )
}
