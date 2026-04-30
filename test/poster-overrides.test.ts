import {
  buildPosterOverrideKey,
  resolvePosterPath,
  sanitizePosterOverrides,
} from "@/lib/poster-overrides"
import { describe, expect, it } from "vitest"

describe("poster overrides", () => {
  it("builds stable keys for movie and tv overrides", () => {
    expect(buildPosterOverrideKey("movie", 42)).toBe("movie_42")
    expect(buildPosterOverrideKey("tv", 7)).toBe("tv_7")
  })

  it("sanitizes invalid override maps and preserves valid entries", () => {
    expect(
      sanitizePosterOverrides({
        movie_42: "/movie-valid.jpg",
        tv_7: "/tv-valid.jpg",
        "movie-no-id": "/invalid.jpg",
        person_5: "/invalid.jpg",
        movie_9: "https://invalid.example/image.jpg",
        tv_8: "",
      }),
    ).toEqual({
      movie_42: "/movie-valid.jpg",
      tv_7: "/tv-valid.jpg",
    })
  })

  it("returns an empty map for non-object values", () => {
    expect(sanitizePosterOverrides(null)).toEqual({})
    expect(sanitizePosterOverrides("invalid")).toEqual({})
  })

  it("resolves an override before falling back to the default poster", () => {
    expect(
      resolvePosterPath({ movie_42: "/custom.jpg" }, "movie", 42, "/default.jpg"),
    ).toBe("/custom.jpg")
  })

  it("falls back to the default poster when no override exists", () => {
    expect(resolvePosterPath({}, "tv", 7, "/default-tv.jpg")).toBe(
      "/default-tv.jpg",
    )
  })

  it("returns null when neither an override nor a fallback exists", () => {
    expect(resolvePosterPath({}, "movie", 42, null)).toBeNull()
  })
})
