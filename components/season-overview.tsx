"use client"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useEffect, useRef, useState } from "react"

interface SeasonOverviewProps {
  overview: string
  blurPlotSpoilers: boolean
}

export function SeasonOverview({
  overview,
  blurPlotSpoilers,
}: SeasonOverviewProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [hasOverflow, setHasOverflow] = useState(false)
  const measurementRef = useRef<HTMLParagraphElement | null>(null)

  useEffect(() => {
    const measure = () => {
      const element = measurementRef.current

      if (!element) {
        return
      }

      const overflow = element.scrollHeight > element.clientHeight
      setHasOverflow(overflow)

      if (!overflow) {
        setIsExpanded(false)
      }
    }

    measure()

    if (typeof ResizeObserver === "undefined" || !measurementRef.current) {
      return
    }

    const observer = new ResizeObserver(() => {
      measure()
    })

    observer.observe(measurementRef.current)

    return () => {
      observer.disconnect()
    }
  }, [overview])

  return (
    <div className="mb-6 max-w-2xl">
      <div className="relative">
        <p
          ref={measurementRef}
          aria-hidden="true"
          data-testid="season-overview-measurement"
          className="pointer-events-none absolute top-0 left-0 m-0 w-full line-clamp-3 text-gray-300 opacity-0"
        >
          {overview}
        </p>
        <p
          data-testid="season-overview-text"
          id="season-overview-text"
          className={cn(
            "text-gray-300",
            !isExpanded && "line-clamp-3",
            blurPlotSpoilers &&
              "blur-md transition-all duration-300 hover:blur-none",
          )}
        >
          {overview}
        </p>
      </div>

      {hasOverflow && (
        <Button
          type="button"
          variant="link"
          size="sm"
          className="mt-2 h-auto px-0 py-0 text-sm font-medium text-primary"
          aria-expanded={isExpanded}
          aria-controls="season-overview-text"
          onClick={() => setIsExpanded((value) => !value)}
        >
          {isExpanded ? "Show less" : "Read more"}
        </Button>
      )}
    </div>
  )
}
