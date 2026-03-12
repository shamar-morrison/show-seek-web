/**
 * Parse TMDB-style YYYY-MM-DD strings as local dates to avoid timezone shifts.
 */
export function parseTmdbDate(dateString: string): Date {
  if (!dateString || typeof dateString !== "string") {
    throw new Error("Invalid date string")
  }

  const [year, month, day] = dateString.split("-").map(Number)

  if (!year || !month || !day) {
    throw new Error(`Invalid TMDB date: ${dateString}`)
  }

  return new Date(year, month - 1, day)
}

export function toLocalDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function getTodayDateKey(): string {
  return toLocalDateKey(new Date())
}
