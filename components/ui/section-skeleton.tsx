import { cn } from "@/lib/utils"

interface SectionSkeletonProps {
  /** Number of skeleton cards to display */
  count?: number
  /** Card width in pixels (only for row variant) */
  cardWidth?: number
  /** Card height in pixels */
  cardHeight?: number
  /** Whether to wrap with section container and title placeholder */
  withSectionWrapper?: boolean
  /** Additional classes for skeleton cards */
  cardClassName?: string
  /** Layout variant: 'row' (horizontal scroll) or 'grid' (responsive grid) */
  variant?: "row" | "grid"
}

/**
 * SectionSkeleton Component
 * Reusable loading skeleton for lazy-loaded media sections.
 * Supports configurable card counts, sizes, and optional section wrapper.
 */
export function SectionSkeleton({
  count = 6,
  cardWidth = 160,
  cardHeight = 280,
  withSectionWrapper = false,
  cardClassName,
  variant = "row",
}: SectionSkeletonProps) {
  const skeleton =
    variant === "row" ? (
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "shrink-0 animate-pulse rounded-lg bg-gray-800",
              cardClassName,
            )}
            style={{ width: cardWidth, height: cardHeight }}
          />
        ))}
      </div>
    ) : (
      <div className="grid grid-cols-2 gap-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "w-full animate-pulse rounded-lg bg-gray-800",
              cardClassName,
            )}
            style={{ height: cardHeight }}
          />
        ))}
      </div>
    )

  if (!withSectionWrapper) {
    return skeleton
  }

  return (
    <section className="py-8">
      <div className="mx-auto mb-4 max-w-[1800px] px-4 sm:px-8 lg:px-12">
        <div className="h-7 w-48 animate-pulse rounded bg-gray-800" />
      </div>
      <div className="mx-auto max-w-[1800px] px-4 sm:px-8 lg:px-12">
        {skeleton}
      </div>
    </section>
  )
}
