import {
  getDisplayMediaTitle,
  getDisplayNormalizedTitle,
} from "@/lib/media-title"
import { describe, expect, it } from "vitest"

describe("media title helpers", () => {
  it("prefers localized title when original titles are disabled", () => {
    const title = getDisplayMediaTitle(
      {
        title: "Spirited Away",
        original_title: "Sen to Chihiro no Kamikakushi",
      },
      false,
    )

    expect(title).toBe("Spirited Away")
  })

  it("prefers original title when original titles are enabled", () => {
    const title = getDisplayMediaTitle(
      {
        name: "Money Heist",
        original_name: "La casa de papel",
      },
      true,
    )

    expect(title).toBe("La casa de papel")
  })

  it("falls back to the alternate title set when preferred values are missing", () => {
    const localizedFallback = getDisplayMediaTitle(
      {
        original_title: "Cidade de Deus",
      },
      false,
    )
    const originalFallback = getDisplayMediaTitle(
      {
        title: "City of God",
      },
      true,
    )

    expect(localizedFallback).toBe("Cidade de Deus")
    expect(originalFallback).toBe("City of God")
  })

  it("returns an empty string when no title values exist", () => {
    const title = getDisplayMediaTitle(
      {
        title: "   ",
        name: "",
        original_title: "   ",
        original_name: "",
      },
      true,
    )

    expect(title).toBe("")
  })

  it("supports normalized title data for hero and trailer payloads", () => {
    expect(
      getDisplayNormalizedTitle(
        {
          title: "Money Heist",
          originalTitle: "La casa de papel",
        },
        true,
      ),
    ).toBe("La casa de papel")
  })
})
