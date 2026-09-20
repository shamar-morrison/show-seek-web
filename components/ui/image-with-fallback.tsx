import { cn } from "@/lib/utils"
import { HugeiconsIcon } from "@hugeicons/react"

interface ImageWithFallbackProps {
  /** Image URL (already processed via buildImageUrl) */
  src: string | null
  /** Alt text for the image */
  alt: string
  /** Text shown when no image is available */
  fallbackText?: string
  /** Icon shown instead of fallbackText when no image is available */
  fallbackIcon?: Parameters<typeof HugeiconsIcon>[0]["icon"]
  /** Container classes - parent controls aspect ratio */
  className?: string
  /** Additional classes for the Image element */
  imageClassName?: string
  /** Next.js Image priority loading */
  priority?: boolean
  /** Next.js Image sizes attribute */
  sizes?: string
}

/**
 * Reusable image component with fallback placeholder
 * Displays an image or a styled placeholder when src is null/undefined
 */
export function ImageWithFallback({
  src,
  alt,
  fallbackText = "No Image",
  fallbackIcon,
  className,
  imageClassName,
  priority = false,
  sizes,
}: ImageWithFallbackProps) {
  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        className={cn(
          "absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105",
          imageClassName,
        )}
        sizes={sizes}
      />
    )
  }

  return (
    <div
      className={cn(
        "flex h-full w-full items-center justify-center bg-gray-800 text-gray-500 text-sm",
        className,
      )}
    >
      {fallbackIcon ? (
        <HugeiconsIcon icon={fallbackIcon} className="size-8" />
      ) : (
        fallbackText
      )}
    </div>
  )
}
