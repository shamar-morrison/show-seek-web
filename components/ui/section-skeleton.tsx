import { cn } from "@/lib/utils"

interface SectionSkeletonProps {
  /** Number of skeleton cards to display */
  count?: number
  /** Card width in pixels */
  cardWidth?: number
  /** Card height in pixels */
  cardHeight?: number
  /** Whether to wrap with section container and title placeholder */
  withSectionWrapper?: boolean
  /** Additional classes for skeleton cards */
  cardClassName?: string
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
}: SectionSkeletonProps) {
  const skeleton = (
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
