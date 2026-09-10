import { formatWatchHours } from "@/lib/format-watch-time"
import { measuredRuntimeMinutes } from "@/lib/utils"
import { describe, expect, it } from "vitest"

describe("formatWatchHours", () => {
  it("formats large totals with plural units", () => {
    expect(formatWatchHours(57727)).toBe("962hrs 7mins")
  })

  it("uses singular units for exactly one", () => {
    expect(formatWatchHours(61)).toBe("1hr 1min")
    expect(formatWatchHours(60)).toBe("1hr 0mins")
    expect(formatWatchHours(1)).toBe("0hrs 1min")
  })

  it("always shows both parts without zero-padding", () => {
    expect(formatWatchHours(90)).toBe("1hr 30mins")
    expect(formatWatchHours(45)).toBe("0hrs 45mins")
    expect(formatWatchHours(120)).toBe("2hrs 0mins")
  })

  it("floors fractional minutes", () => {
    expect(formatWatchHours(61.9)).toBe("1hr 1min")
  })

  it("maps zero, negative, and non-finite input to 0hrs 0mins", () => {
    expect(formatWatchHours(0)).toBe("0hrs 0mins")
    expect(formatWatchHours(-30)).toBe("0hrs 0mins")
    expect(formatWatchHours(NaN)).toBe("0hrs 0mins")
    expect(formatWatchHours(Infinity)).toBe("0hrs 0mins")
  })
})

describe("measuredRuntimeMinutes", () => {
  it("stamps positive finite runtimes", () => {
    expect(measuredRuntimeMinutes(45)).toEqual({ runtimeMinutes: 45 })
  })

  it("omits zero, negative, null, undefined, and non-finite runtimes", () => {
    expect(measuredRuntimeMinutes(0)).toEqual({})
    expect(measuredRuntimeMinutes(-5)).toEqual({})
    expect(measuredRuntimeMinutes(null)).toEqual({})
    expect(measuredRuntimeMinutes(undefined)).toEqual({})
    expect(measuredRuntimeMinutes(NaN)).toEqual({})
    expect(measuredRuntimeMinutes(Infinity)).toEqual({})
  })
})
