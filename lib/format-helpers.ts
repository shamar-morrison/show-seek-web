/**
 * Shared formatting utilities for dates and runtimes
 */

/**
 * Format a date string to a long format (e.g., "January 8, 2026")
 * @param dateString - ISO date string or null
 * @returns Formatted date string or null if input is null/undefined
 */
export function formatDateLong(dateString: string | null): string | null {
  if (!dateString) return null
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

/**
 * Format a date string to a short format (e.g., "Jan 8, 2026")
 * @param dateString - ISO date string or null
 * @returns Formatted date string or null if input is null/undefined
 */
export function formatDateShort(dateString: string | null): string | null {
  if (!dateString) return null
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

/**
 * Format runtime in minutes to a human-readable format (e.g., "1h 30m" or "45m")
 * @param minutes - Runtime in minutes or null
 * @returns Formatted runtime string or null if input is null/undefined/0
 */
export function formatRuntime(minutes: number | null): string | null {
  if (!minutes) return null
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}
