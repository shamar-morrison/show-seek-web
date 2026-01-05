"use client"

import { useEffect, useRef, useState } from "react"

interface UseIntersectionObserverOptions {
  rootMargin?: string
  threshold?: number | number[]
}

const DEFAULT_OPTIONS: UseIntersectionObserverOptions = {
  rootMargin: "200px",
  threshold: 0,
}

/**
 * useIntersectionObserver Hook
 * Generic hook for lazy-loading content when scrolled into view.
 * Triggers callback once when element enters viewport.
 *
 * @param onIntersect - Callback to run when element becomes visible
 * @param options - IntersectionObserver options (rootMargin, threshold)
 * @returns ref to attach to target element, and whether it has intersected
 */
export function useIntersectionObserver<T extends HTMLElement = HTMLElement>(
  onIntersect: () => void,
  options: UseIntersectionObserverOptions = DEFAULT_OPTIONS,
) {
  const ref = useRef<T>(null)
  const [hasIntersected, setHasIntersected] = useState(false)
  // Store callback in ref to avoid re-running effect on callback changes
  const onIntersectRef = useRef(onIntersect)

  // Update ref in effect to avoid mutating refs during render
  useEffect(() => {
    onIntersectRef.current = onIntersect
  })

  useEffect(() => {
    if (hasIntersected || !ref.current) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasIntersected(true)
          onIntersectRef.current()
        }
      },
      {
        rootMargin: options.rootMargin ?? DEFAULT_OPTIONS.rootMargin,
        threshold: options.threshold ?? DEFAULT_OPTIONS.threshold,
      },
    )

    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [hasIntersected, options.rootMargin, options.threshold])

  return { ref, hasIntersected }
}
