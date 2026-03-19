import {
  calculateTmdbAge,
  formatTmdbDate,
  getTmdbDateYear,
  isTmdbDateOnOrBeforeToday,
  parseTmdbDate,
  toLocalDateKey,
} from "@/lib/tmdb-date"
import { afterEach, describe, expect, it } from "vitest"

const originalTimeZone = process.env.TZ

function restoreTimeZone() {
  if (originalTimeZone === undefined) {
    delete process.env.TZ
    return
  }

  process.env.TZ = originalTimeZone
}

function withTimeZone<T>(timeZone: string, callback: () => T): T {
  const previousTimeZone = process.env.TZ
  process.env.TZ = timeZone

  try {
    return callback()
  } finally {
    if (previousTimeZone === undefined) {
      delete process.env.TZ
    } else {
      process.env.TZ = previousTimeZone
    }
  }
}

afterEach(() => {
  restoreTimeZone()
})

describe("tmdb date helpers", () => {
  it("formats TMDB dates without shifting them to the previous day", () => {
    withTimeZone("America/Jamaica", () => {
      expect(
        formatTmdbDate("2024-03-27", {
          month: "long",
          day: "numeric",
          year: "numeric",
        }),
      ).toBe("March 27, 2024")
    })
  })

  it("keeps January 1 in the correct year for negative UTC offsets", () => {
    withTimeZone("America/Jamaica", () => {
      expect(getTmdbDateYear("2024-01-01")).toBe(2024)
      expect(toLocalDateKey(parseTmdbDate("2024-01-01"))).toBe("2024-01-01")
    })
  })

  it("treats the same local calendar day as aired and future days as unaired", () => {
    withTimeZone("America/Jamaica", () => {
      const sameDayReference = new Date(2024, 2, 27, 12, 0, 0)

      expect(
        isTmdbDateOnOrBeforeToday("2024-03-27", sameDayReference),
      ).toBe(true)
      expect(
        isTmdbDateOnOrBeforeToday("2024-03-28", sameDayReference),
      ).toBe(false)
    })
  })

  it("calculates ages around birthday boundaries using local calendar dates", () => {
    withTimeZone("America/Jamaica", () => {
      expect(
        calculateTmdbAge("1990-06-15", null, new Date(2024, 5, 14, 23, 0, 0)),
      ).toBe(33)
      expect(
        calculateTmdbAge("1990-06-15", null, new Date(2024, 5, 15, 12, 0, 0)),
      ).toBe(34)
    })
  })

  it("uses the death date as the age endpoint when present", () => {
    withTimeZone("America/Jamaica", () => {
      expect(
        calculateTmdbAge(
          "1990-06-15",
          "2020-06-14",
          new Date(2024, 5, 20, 12, 0, 0),
        ),
      ).toBe(29)
    })
  })
})
