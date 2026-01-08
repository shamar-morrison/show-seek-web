import { CrownIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "@/lib/utils"

interface PremiumBadgeProps {
  /**
   * Whether the user has premium status.
   * - true: displays in amber (unlocked/active state)
   * - false: displays in gray (locked/inactive state)
   */
  isPremium?: boolean
  className?: string
}

export function PremiumBadge({
  isPremium = false,
  className,
}: PremiumBadgeProps) {
  return (
    <span
      className={cn(
        "flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        isPremium
          ? "bg-amber-500/20 text-amber-400"
          : "bg-white/10 text-white/60",
        className,
      )}
    >
      <HugeiconsIcon icon={CrownIcon} className="size-3" />
      Premium
    </span>
  )
}
