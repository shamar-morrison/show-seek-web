import { safeParseInt } from "@/lib/utils"

/** Slider bounds for the Discover runtime filter (minutes). */
export const RUNTIME_MIN = 60
export const RUNTIME_MAX = 240
export const RUNTIME_STEP = 5

/** Committed runtime range [minMinutes, maxMinutes]; null = filter off. */
export type RuntimeRange = [number, number]

const FULL_RANGE_KEY = `${RUNTIME_MIN}-${RUNTIME_MAX}`

function rangeKey(range: RuntimeRange): string {
  return `${range[0]}-${range[1]}`
}

/**
 * Whether a range covers the full slider span. Full-span selections are
 * treated as "off" (params omitted) so titles with unknown runtime data
 * are not excluded by TMDB.
 */
export function isFullRuntimeRange(range: RuntimeRange): boolean {
  return rangeKey(range) === FULL_RANGE_KEY
}

/**
 * Parse and validate minRuntime/maxRuntime URL params into a RuntimeRange.
 * Out-of-bounds values are clamped; missing, non-numeric, inverted, or
 * full-span values return null (filter off).
 */
export function parseRuntimeRange(
  minRaw: string | string[] | undefined,
  maxRaw: string | string[] | undefined,
): RuntimeRange | null {
  const minValue = Array.isArray(minRaw) ? minRaw[0] : minRaw
  const maxValue = Array.isArray(maxRaw) ? maxRaw[0] : maxRaw
  const min = safeParseInt(minValue)
  const max = safeParseInt(maxValue)

  if (min === undefined || max === undefined) return null

  const clampedMin = Math.min(Math.max(min, RUNTIME_MIN), RUNTIME_MAX)
  const clampedMax = Math.min(Math.max(max, RUNTIME_MIN), RUNTIME_MAX)

  if (clampedMin > clampedMax) return null

  const range: RuntimeRange = [clampedMin, clampedMax]
  return isFullRuntimeRange(range) ? null : range
}
