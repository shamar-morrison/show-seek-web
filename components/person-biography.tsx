"use client"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useEffect, useRef, useState } from "react"

interface PersonBiographyProps {
  biography: string | null | undefined
  personName: string
}

export function PersonBiography({
  biography,
  personName,
}: PersonBiographyProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [hasOverflow, setHasOverflow] = useState(false)
  const measurementRef = useRef<HTMLParagraphElement | null>(null)

  const bioText =
    biography?.trim() || `We don't have a biography for ${personName}.`

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
  }, [bioText])

  return (
    <div className="mb-8">
      <h2 className="mb-2 text-xl font-bold">Biography</h2>
      <div className="prose prose-invert max-w-none text-gray-300">
        <div className="relative">
          <p
            ref={measurementRef}
            aria-hidden="true"
            data-testid="person-biography-measurement"
            className="pointer-events-none absolute top-0 left-0 m-0 w-full line-clamp-4 whitespace-pre-wrap leading-relaxed opacity-0"
          >
            {bioText}
          </p>
          <p
            data-testid="person-biography-text"
            id="person-biography-text"
            className={cn(
              "whitespace-pre-wrap leading-relaxed",
              !isExpanded && "line-clamp-4",
            )}
          >
            {bioText}
          </p>
        </div>

        {hasOverflow && (
          <Button
            type="button"
            variant="link"
            size="sm"
            className="mt-2 h-auto px-0 py-0 text-sm font-medium text-primary"
            aria-expanded={isExpanded}
            aria-controls="person-biography-text"
            onClick={() => setIsExpanded((value) => !value)}
          >
            {isExpanded ? "Show less" : "Read more"}
          </Button>
        )}
      </div>
    </div>
  )
}
