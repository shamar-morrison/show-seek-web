/**
 * Formatting utilities for total watch time.
 *
 * Ported from mobile `src/utils/formatWatchTime.ts` (`formatWatchHours`).
 * Hours are unbounded and unpadded; minutes are not padded either.
 * Units are pluralized English abbreviations ("1hr 1min" vs "2hrs 5mins").
 * Non-finite or negative inputs are treated as 0. No thousands separators,
 * no days conversion.
 */

/** Decomposed watch-time value. Units already carry singular/plural rules. */
export interface WatchTimeParts {
  hours: number
  hourUnit: "hr" | "hrs"
  minutes: number
  minuteUnit: "min" | "mins"
}

/**
 * Split a total-minutes watch time into hours/minutes parts.
 * `formatWatchHours` is built on this, so the two cannot drift.
 */
export function getWatchTimeParts(totalMinutes: number): WatchTimeParts {
  const safeMinutes =
    Number.isFinite(totalMinutes) && totalMinutes > 0
      ? Math.floor(totalMinutes)
      : 0
  const hours = Math.floor(safeMinutes / 60)
  const minutes = safeMinutes % 60
  return {
    hours,
    hourUnit: hours === 1 ? "hr" : "hrs",
    minutes,
    minuteUnit: minutes === 1 ? "min" : "mins",
  }
}

/** Format a total-minutes watch time, e.g. 57727 -> "962hrs 7mins". */
export function formatWatchHours(totalMinutes: number): string {
  const { hours, hourUnit, minutes, minuteUnit } =
    getWatchTimeParts(totalMinutes)
  return `${hours}${hourUnit} ${minutes}${minuteUnit}`
}
