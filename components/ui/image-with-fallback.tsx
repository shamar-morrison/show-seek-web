import { cn } from "@/lib/utils"
import Image from "next/image"

interface ImageWithFallbackProps {
  /** Image URL (already processed via buildImageUrl) */
  src: string | null
  /** Alt text for the image */
  alt: string
  /** Text shown when no image is available */
  fallbackText?: string
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
  className,
  imageClassName,
  priority = false,
  sizes,
}: ImageWithFallbackProps) {
  if (src) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        className={cn(
          "object-cover transition-transform duration-300 group-hover:scale-105",
          imageClassName,
        )}
        sizes={sizes}
        priority={priority}
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
      {fallbackText}
    </div>
  )
}
