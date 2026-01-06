import { cn } from "@/lib/utils"
import { Avatar as AvatarRoot } from "@base-ui/react/avatar"

interface AvatarProps {
  src?: string | null
  alt?: string
  fallback?: string
  className?: string
  size?: "sm" | "md" | "lg"
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

export function Avatar({
  src,
  alt = "User avatar",
  fallback,
  className,
  size = "md",
}: AvatarProps) {
  const initials = fallback ? getInitials(fallback) : "?"

  return (
    <AvatarRoot.Root
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/10",
        sizeClasses[size],
        className,
      )}
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
  )
}
