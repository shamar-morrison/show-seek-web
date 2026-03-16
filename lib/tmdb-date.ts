const TMDB_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

function getTmdbDateParts(dateString: string): [number, number, number] {
  if (!dateString || typeof dateString !== "string") {
    throw new Error("Invalid date string: expected non-empty string")
  }

  const match = TMDB_DATE_PATTERN.exec(dateString)
  if (!match) {
    throw new Error(
      `Invalid date string: expected YYYY-MM-DD format, received ${dateString}`,
    )
  }

  return match.slice(1).map(Number) as [number, number, number]
}

/**
 * Parse TMDB-style YYYY-MM-DD strings as local dates to avoid timezone shifts.
 */
export function parseTmdbDate(dateString: string): Date {
  const [year, month, day] = getTmdbDateParts(dateString)
  const parsedDate = new Date(year, month - 1, day)

  if (toLocalDateKey(parsedDate) !== dateString) {
    throw new Error(
      `Invalid date string: expected YYYY-MM-DD format, received ${dateString}`,
    )
  }

  return parsedDate
}

export function formatTmdbDate(
  dateString: string,
  options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  },
  locale = "en-US",
): string {
  return parseTmdbDate(dateString).toLocaleDateString(locale, options)
}

export function getTmdbDateYear(dateString: string): number {
  return parseTmdbDate(dateString).getFullYear()
}

export function compareTmdbDateStrings(
  left: string | null | undefined,
  right: string | null | undefined,
): number {
  return (left ?? "").localeCompare(right ?? "")
}

export function toLocalDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function isTmdbDateOnOrBeforeToday(
  dateString: string | null | undefined,
  referenceDate = new Date(),
): boolean {
  if (!dateString) {
    return false
  }

  parseTmdbDate(dateString)
  return dateString <= toLocalDateKey(referenceDate)
}

export function calculateTmdbAge(
  birthday: string | null,
  deathday: string | null = null,
  referenceDate = new Date(),
): number | null {
  if (!birthday) {
    return null
  }

  const birthDate = parseTmdbDate(birthday)
  const endDate = deathday ? parseTmdbDate(deathday) : referenceDate

  let age = endDate.getFullYear() - birthDate.getFullYear()
  const hasReachedBirthdayThisYear =
    endDate.getMonth() > birthDate.getMonth() ||
    (endDate.getMonth() === birthDate.getMonth() &&
      endDate.getDate() >= birthDate.getDate())

  if (!hasReachedBirthdayThisYear) {
    age -= 1
  }

  return age
}

export function getTodayDateKey(): string {
  return toLocalDateKey(new Date())
}
