import { parseRatingsYearRange } from "@/app/ratings/ratings-page-client"
import { parseListsYearRange } from "@/components/lists-page-client"
import { describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
}))

const MIN_YEAR = 1950
const CURRENT_YEAR = new Date().getFullYear()

function params(query: string): URLSearchParams {
  return new URLSearchParams(query)
}

describe.each([
  ["parseListsYearRange", parseListsYearRange],
  ["parseRatingsYearRange", parseRatingsYearRange],
] as const)("%s", (_name, parseYearRange) => {
  it("returns the full range when no params are present", () => {
    expect(parseYearRange(params(""))).toEqual([MIN_YEAR, CURRENT_YEAR])
  })

  it("keeps a min-only range instead of resetting", () => {
    // Regression test: dragging just the min thumb serializes to only
    // ?yearMin=2000, which used to snap the slider back to full range.
    expect(parseYearRange(params("?yearMin=2000"))).toEqual([
      2000, CURRENT_YEAR,
    ])
  })

  it("keeps a max-only range instead of resetting", () => {
    expect(parseYearRange(params("?yearMax=2010"))).toEqual([MIN_YEAR, 2010])
  })

  it("parses a full min/max pair", () => {
    expect(parseYearRange(params("?yearMin=1990&yearMax=2010"))).toEqual([
      1990, 2010,
    ])
  })

  it("clamps out-of-bounds values to the slider span", () => {
    expect(parseYearRange(params("?yearMin=1800"))).toEqual([
      MIN_YEAR,
      CURRENT_YEAR,
    ])
    expect(parseYearRange(params(`?yearMax=${CURRENT_YEAR + 10}`))).toEqual([
      MIN_YEAR,
      CURRENT_YEAR,
    ])
  })

  it("resets inverted ranges to the full range", () => {
    expect(parseYearRange(params("?yearMin=2010&yearMax=2000"))).toEqual([
      MIN_YEAR,
      CURRENT_YEAR,
    ])
  })

  it("ignores non-numeric values for that bound", () => {
    expect(parseYearRange(params("?yearMin=soon&yearMax=2010"))).toEqual([
      MIN_YEAR,
      2010,
    ])
  })
})
