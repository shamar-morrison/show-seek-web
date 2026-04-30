import {
  DEFAULT_PREFERENCES,
  hydrateUserPreferences,
} from "@/lib/user-preferences"
import { describe, expect, it } from "vitest"

describe("user preferences", () => {
  it("defaults auto-remove from Should Watch to enabled", () => {
    expect(DEFAULT_PREFERENCES.autoRemoveFromShouldWatch).toBe(true)
  })

  it("defaults original titles to disabled", () => {
    expect(DEFAULT_PREFERENCES.showOriginalTitles).toBe(false)
  })

  it("defaults bulk add behavior to move", () => {
    expect(DEFAULT_PREFERENCES.copyInsteadOfMove).toBe(false)
  })

  it("defaults poster overrides to an empty map", () => {
    expect(DEFAULT_PREFERENCES.posterOverrides).toEqual({})
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

  it("hydrates original title preference from stored preferences", () => {
    expect(hydrateUserPreferences({ showOriginalTitles: true })).toMatchObject({
      showOriginalTitles: true,
    })
  })

  it("hydrates copyInsteadOfMove from stored preferences", () => {
    expect(
      hydrateUserPreferences({ copyInsteadOfMove: true }),
    ).toMatchObject({
      copyInsteadOfMove: true,
    })
  })

  it("hydrates poster overrides from valid stored preferences only", () => {
    expect(
      hydrateUserPreferences({
        posterOverrides: {
          movie_12: "/spirited-away-alt.jpg",
          tv_8: "/show-alt.jpg",
          invalid: "/nope.jpg",
          movie_44: "https://example.com/nope.jpg",
        },
      }),
    ).toMatchObject({
      posterOverrides: {
        movie_12: "/spirited-away-alt.jpg",
        tv_8: "/show-alt.jpg",
      },
    })
  })

  it("defaults original title preference when the stored key is omitted", () => {
    expect(hydrateUserPreferences({})).toMatchObject({
      showOriginalTitles: false,
    })
  })

  it("normalizes undefined original title preference to false", () => {
    expect(
      hydrateUserPreferences({ showOriginalTitles: undefined }),
    ).toMatchObject({
      showOriginalTitles: false,
    })
  })

  it("normalizes missing poster overrides to an empty map", () => {
    expect(hydrateUserPreferences({})).toMatchObject({
      posterOverrides: {},
    })
  })
})
