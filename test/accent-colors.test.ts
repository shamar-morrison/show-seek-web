import {
  ACCENT_COLORS,
  DEFAULT_ACCENT_COLOR,
  getAccentColorName,
  isAccentColor,
  resolveAccentColor,
} from "@/lib/accent-colors"
import { mapPreferencesCacheData } from "@/lib/preferences-cache"
import { describe, expect, it } from "vitest"

describe("accent colors", () => {
  it("matches the mobile palette (17 colors, brand red default)", () => {
    expect(DEFAULT_ACCENT_COLOR).toBe("#E50914")
    expect(ACCENT_COLORS).toHaveLength(17)
    expect(ACCENT_COLORS.map((color) => color.value)).toContain("#E50914")
  })

  it("validates supported colors", () => {
    expect(isAccentColor("#3B82F6")).toBe(true)
    expect(isAccentColor("#E50914")).toBe(true)
    expect(isAccentColor("#000000")).toBe(false)
    expect(isAccentColor("red")).toBe(false)
  })

  it("resolves color names with a Red fallback", () => {
    expect(getAccentColorName("#3B82F6")).toBe("Blue")
    expect(getAccentColorName("#E50914")).toBe("Red")
    expect(getAccentColorName("bogus")).toBe("Red")
  })

  it("resolveAccentColor falls back to the default for invalid values", () => {
    expect(resolveAccentColor("#8B5CF6")).toBe("#8B5CF6")
    expect(resolveAccentColor("bogus")).toBe(DEFAULT_ACCENT_COLOR)
    expect(resolveAccentColor(undefined)).toBe(DEFAULT_ACCENT_COLOR)
  })
})

describe("accent color cross-device mapping", () => {
  it("prefers the nested web preference over the mobile top-level field", () => {
    expect(
      mapPreferencesCacheData({
        preferences: { accentColor: "#3B82F6" },
        accentColor: "#10B981",
      }).preferences.accentColor,
    ).toBe("#3B82F6")
  })

  it("falls back to the mobile top-level field when no nested value exists", () => {
    expect(
      mapPreferencesCacheData({ accentColor: "#10B981" }).preferences
        .accentColor,
    ).toBe("#10B981")
  })

  it("keeps an explicit Red pick instead of a stale top-level value", () => {
    expect(
      mapPreferencesCacheData({
        preferences: { accentColor: "#E50914" },
        accentColor: "#10B981",
      }).preferences.accentColor,
    ).toBe("#E50914")
  })

  it("ignores invalid top-level values", () => {
    expect(
      mapPreferencesCacheData({ accentColor: "bogus" }).preferences.accentColor,
    ).toBe(DEFAULT_ACCENT_COLOR)
  })

  it("defaults when nothing is stored", () => {
    expect(mapPreferencesCacheData(undefined).preferences.accentColor).toBe(
      DEFAULT_ACCENT_COLOR,
    )
  })
})
