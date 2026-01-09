"use client"

import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useCallback, useEffect, useRef, useState } from "react"

import { cn } from "@/lib/utils"

interface ScrollableRowProps {
  /** The scrollable content */
  children: React.ReactNode
  /** Optional additional classes for the scroll container */
  className?: string
  /** Scroll amount as percentage of container width (default: 75) */
  scrollPercentage?: number
  /** Gap between items (default: 16px / gap-4) */
  gap?: number
}

/**
 * ScrollableRow Component
 * A reusable wrapper that adds navigation arrows to horizontally scrollable content.
 * Arrows appear on hover when there's more content to scroll in that direction.
 */
export function ScrollableRow({
  children,
  className,
  scrollPercentage = 75,
  gap = 16,
}: ScrollableRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const [isHovering, setIsHovering] = useState(false)

  // Check scroll position and update arrow visibility
  const updateScrollState = useCallback(() => {
    const container = scrollRef.current
    if (!container) return

    const { scrollLeft, scrollWidth, clientWidth } = container
    // Small threshold to account for rounding errors
    const threshold = 2

    setCanScrollLeft(scrollLeft > threshold)
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - threshold)
  }, [])

  // Set up scroll listener and initial state
  useEffect(() => {
    const container = scrollRef.current
    if (!container) return

    // Initial check
    updateScrollState()

    // Listen for scroll events
    container.addEventListener("scroll", updateScrollState, { passive: true })

    // Also listen for resize to handle dynamic content (if supported)
    let resizeObserver: ResizeObserver | undefined
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(updateScrollState)
      resizeObserver.observe(container)
    }

    return () => {
      container.removeEventListener("scroll", updateScrollState)
      resizeObserver?.disconnect()
    }
  }, [updateScrollState])

  // Scroll by percentage of visible width
  const scroll = useCallback(
    (direction: "left" | "right") => {
      const container = scrollRef.current
      if (!container) return

      const scrollAmount = (container.clientWidth * scrollPercentage) / 100
      const targetScroll =
        direction === "left"
          ? container.scrollLeft - scrollAmount
          : container.scrollLeft + scrollAmount

      container.scrollTo({
        left: targetScroll,
        behavior: "smooth",
      })
    },
    [scrollPercentage],
  )

  return (
    <div
      className="group/scroll relative"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Left Arrow */}
      {canScrollLeft && isHovering && (
        <div className="pointer-events-none absolute top-0 bottom-0 left-0 z-10 flex items-center">
          {/* Gradient fade */}
          <div className="absolute inset-y-0 left-0 w-16 bg-linear-to-r from-background to-transparent" />
          {/* Arrow button */}
          <button
            type="button"
            onClick={() => scroll("left")}
            className="pointer-events-auto relative ml-2 flex size-10 items-center justify-center rounded-full bg-background/80 text-foreground/80 shadow-lg backdrop-blur-sm transition-all hover:bg-background hover:text-foreground"
            aria-label="Scroll left"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} className="size-5" />
          </button>
        </div>
      )}

      {/* Scrollable content */}
      <div
        ref={scrollRef}
        className={cn("flex overflow-x-auto scrollbar-hide", className)}
        style={{ gap: `${gap}px` }}
      >
        {children}
      </div>

      {/* Right Arrow */}
      {canScrollRight && isHovering && (
        <div className="pointer-events-none absolute top-0 right-0 bottom-0 z-10 flex items-center">
          {/* Gradient fade */}
          <div className="absolute inset-y-0 right-0 w-16 bg-linear-to-l from-background to-transparent" />
          {/* Arrow button */}
          <button
            type="button"
            onClick={() => scroll("right")}
            className="pointer-events-auto relative mr-2 flex size-10 items-center justify-center rounded-full bg-background/80 text-foreground/80 shadow-lg backdrop-blur-sm transition-all hover:bg-background hover:text-foreground"
            aria-label="Scroll right"
          >
            <HugeiconsIcon icon={ArrowRight01Icon} className="size-5" />
          </button>
        </div>
      )}
    </div>
  )
}
