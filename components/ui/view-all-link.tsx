import { cn } from "@/lib/utils"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import Link from "next/link"

interface ViewAllLinkProps {
  /** If provided, renders as a Link; otherwise renders as a disabled button */
  href?: string
  /** Custom label (default: "View all") */
  label?: string
  /** If true, renders as a disabled button */
  disabled?: boolean
  className?: string
}

/**
 * ViewAllLink Component
 * Standardized "View all" navigation link with arrow icon and hover animation.
 * Supports both Link and disabled button modes.
 */
export function ViewAllLink({
  href,
  label = "View all",
  disabled = false,
  className = "",
}: ViewAllLinkProps) {
  const isDisabled = disabled || !href
  const baseClasses = cn(
    "group flex items-center gap-1 text-sm font-medium text-gray-400 transition-colors",
    !isDisabled && "hover:text-white",
    isDisabled && "cursor-not-allowed opacity-60",
    className,
  )

  if (isDisabled) {
    return (
      <button className={baseClasses} disabled>
        {label}
        <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
      </button>
    )
  }

  return (
    <Link href={href!} className={baseClasses}>
      {label}
      <HugeiconsIcon
        icon={ArrowRight01Icon}
        className="size-4 transition-transform group-hover:translate-x-1"
      />
    </Link>
  )
}
