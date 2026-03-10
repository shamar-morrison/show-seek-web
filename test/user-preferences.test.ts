import {
  DEFAULT_PREFERENCES,
  hydrateUserPreferences,
} from "@/lib/user-preferences"
import { describe, expect, it } from "vitest"

describe("user preferences", () => {
  it("defaults auto-remove from Should Watch to enabled", () => {
    expect(DEFAULT_PREFERENCES.autoRemoveFromShouldWatch).toBe(true)
  })

  it("hydrates the new preference key from stored preferences", () => {
    expect(
      hydrateUserPreferences({ autoRemoveFromShouldWatch: false }),
    ).toMatchObject({
      autoRemoveFromShouldWatch: false,
    })
  })

  it("falls back to the legacy preference key when the new key is missing", () => {
    expect(
      hydrateUserPreferences({ autoRemoveWatchedFromWatchlist: false }),
    ).toMatchObject({
      autoRemoveFromShouldWatch: false,
    })
  })

  it("prefers the new key when both new and legacy values exist", () => {
    expect(
      hydrateUserPreferences({
        autoRemoveFromShouldWatch: true,
        autoRemoveWatchedFromWatchlist: false,
      }),
    ).toMatchObject({
      autoRemoveFromShouldWatch: true,
    })
  })
})
