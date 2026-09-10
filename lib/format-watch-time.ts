/**
 * Watch-time duration formatting (mobile-exact style).
 *
 * Ported from the mobile app's formatWatchHours — intentionally separate from
 * the existing formatRuntime ("1h 30m") convention. Total-hours surfaces use
 * this style exclusively (e.g. "72hrs 30mins", "1hr 1min", "0hrs 0mins").
 */

/**
 * Format a total-minutes watch time in mobile-exact style.
 * - Pluralization: "1hr 1min" vs "2hrs 2mins" (both parts always shown)
 * - Zero: "0hrs 0mins"; non-finite/negative inputs also yield "0hrs 0mins"
 * - No zero-padding on minutes
 */
export function formatWatchHours(totalMinutes: number): string {
  const safeMinutes =
    Number.isFinite(totalMinutes) && totalMinutes > 0
      ? Math.floor(totalMinutes)
      : 0
  const hours = Math.floor(safeMinutes / 60)
  const minutes = safeMinutes % 60
  return `${hours}${hours === 1 ? "hr" : "hrs"} ${minutes}${
    minutes === 1 ? "min" : "mins"
  }`
}
