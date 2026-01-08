import { cn } from "@/lib/utils"
import { Avatar as AvatarRoot } from "@base-ui/react/avatar"
import { CrownIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

interface AvatarProps {
  src?: string | null
  alt?: string
  fallback?: string
  className?: string
  size?: "sm" | "md" | "lg"
  isPremium?: boolean
}

/**
 * Generate initials from a display name
 * e.g., "John Doe" -> "JD", "John" -> "J"
 */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase()
  }
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

const sizeClasses = {
  sm: "size-7 text-xs",
  md: "size-9 text-sm",
  lg: "size-12 text-base",
}

const crownSizeClasses = {
  sm: "size-3",
  md: "size-3.5",
  lg: "size-4",
}

export function Avatar({
  src,
  alt = "User avatar",
  fallback,
  className,
  size = "md",
  isPremium = false,
}: AvatarProps) {
  const initials = fallback ? getInitials(fallback) : "?"

  return (
    <div className="relative inline-flex">
      <AvatarRoot.Root
        className={cn(
          "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/10",
          sizeClasses[size],
          isPremium &&
            "ring-gradient-to-br from-yellow-400 via-amber-500 to-yellow-600",
          className,
        )}
        style={
          isPremium
            ? {
                boxShadow: "0 0 0 3px transparent",
                background:
                  "linear-gradient(#1a1a1a, #1a1a1a) padding-box, linear-gradient(135deg, #fbbf24, #f59e0b, #d97706) border-box",
                border: "2px solid transparent",
              }
            : undefined
        }
      >
        <AvatarRoot.Image
          src={src || undefined}
          alt={alt}
          className="size-full object-cover"
        />
        <AvatarRoot.Fallback className="flex size-full items-center justify-center font-medium text-white">
          {initials}
        </AvatarRoot.Fallback>
      </AvatarRoot.Root>

      {isPremium && (
        <div
          className={cn(
            "absolute bottom-0 right-0 flex items-center justify-center rounded-full bg-linear-to-br from-yellow-400 via-amber-500 to-yellow-600 p-0.5",
            crownSizeClasses[size],
          )}
        >
          <HugeiconsIcon icon={CrownIcon} className="size-full text-gray-900" />
        </div>
      )}
    </div>
  )
}
