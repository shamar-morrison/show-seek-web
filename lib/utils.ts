import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function safeParseInt(
  value: string | number | undefined | null,
): number | undefined {
  if (value === undefined || value === null) return undefined
  const parsed = parseInt(String(value), 10)
  return isNaN(parsed) ? undefined : parsed
}

/** AND/OR combination operator for multi-select genre filters (mobile parity). */
export type GenreOperator = "and" | "or"

export function parseGenreOperator(
  value: string | string[] | undefined | null,
): GenreOperator {
  const raw = Array.isArray(value) ? value[0] : value
  return raw === "and" ? "and" : "or"
}

/**
 * Parse a comma-separated (or repeated-param) list of ints into a number array.
 * Backwards compatible with single values: "28" -> [28].
 */
export function parseIntList(
  value: string | string[] | undefined | null,
): number[] {
  if (value === undefined || value === null) return []
  const raw = Array.isArray(value) ? value.join(",") : String(value)
  if (!raw.trim()) return []
  return raw
    .split(",")
    .map((part) => parseInt(part.trim(), 10))
    .filter((n) => !isNaN(n))
}

/**
 * Format a timestamp to a relative time string
 * e.g., "just now", "yesterday", "2 days ago", "1 week ago"
 */
export function formatRelativeTime(timestamp: Date | number): string {
  const now = new Date()
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp)

  // Handle future timestamps - return formatted date instead of negative relative time
  if (date > now) {
    return date.toLocaleDateString()
  }

  const diffMs = now.getTime() - date.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)
  const diffWeeks = Math.floor(diffDays / 7)
  const diffMonths = Math.floor(diffDays / 30)

  if (diffSeconds < 60) return "just now"
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return "yesterday"
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffWeeks === 1) return "1 week ago"
  if (diffWeeks < 4) return `${diffWeeks} weeks ago`
  if (diffMonths === 1) return "1 month ago"
  if (diffMonths < 12) return `${diffMonths} months ago`
  return date.toLocaleDateString()
}

/**
 * Capture an exception and send it to the error tracking service
 * (Placeholder for Sentry/LogRocket/etc.)
 */
export function captureException(error: unknown) {
  console.error("Captured exception:", error)
}

/**
 * Generate the detail page URL for a media item based on its type
 * @param type - Media type: "movie", "tv", or "person"
 * @param id - TMDB media ID
 * @returns URL path to the detail page
 */
export function getMediaUrl(type: string, id: number): string {
  switch (type) {
    case "movie":
      return `/movie/${id}`
    case "tv":
      return `/tv/${id}`
    case "person":
      return `/person/${id}`
    default:
      return "/"
  }
}
