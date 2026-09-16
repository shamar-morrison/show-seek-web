import {
  filterNonScriptedTV,
  isTalkOrAwardsShow,
} from "@/lib/non-scripted-filter"
import { describe, expect, it } from "vitest"

describe("isTalkOrAwardsShow", () => {
  it("matches Talk / News genre IDs and nothing else", () => {
    expect(
      isTalkOrAwardsShow({
        id: 1,
        media_type: "tv",
        name: "Some Show",
        genre_ids: [10767],
      }),
    ).toBe(true)
    expect(
      isTalkOrAwardsShow({
        id: 2,
        media_type: "tv",
        name: "Some Show",
        genre_ids: [10763],
      }),
    ).toBe(true)
    // Reality (10764) is deliberately NOT excluded — Survivor keeps showing.
    expect(
      isTalkOrAwardsShow({
        id: 3,
        media_type: "tv",
        name: "Survivor",
        genre_ids: [10764],
      }),
    ).toBe(false)
    // Scripted drama genres never match.
    expect(
      isTalkOrAwardsShow({
        id: 4,
        media_type: "tv",
        name: "The West Wing",
        genre_ids: [18],
      }),
    ).toBe(false)
  })

  it("matches the verified TV ID blocklist", () => {
    expect(
      isTalkOrAwardsShow({
        id: 1408,
        media_type: "tv",
        name: "Saturday Night Live",
        genre_ids: [35],
      }),
    ).toBe(true)
    expect(
      isTalkOrAwardsShow({
        id: 2224,
        media_type: "tv",
        name: "The Daily Show",
        genre_ids: [35],
      }),
    ).toBe(true)
  })

  it("matches exact talk-show titles (normalized)", () => {
    expect(
      isTalkOrAwardsShow({
        id: 100,
        media_type: "tv",
        name: "Jimmy Kimmel Live!",
        genre_ids: [35],
      }),
    ).toBe(true)
    expect(
      isTalkOrAwardsShow({
        id: 101,
        media_type: "tv",
        name: "The Tonight Show Starring Jimmy Fallon",
        genre_ids: [],
      }),
    ).toBe(true)
  })

  it("matches award ceremonies, including year-suffixed variants", () => {
    expect(
      isTalkOrAwardsShow({
        id: 200,
        media_type: "tv",
        name: "The Academy Awards",
        genre_ids: [],
      }),
    ).toBe(true)
    expect(
      isTalkOrAwardsShow({
        id: 201,
        media_type: "tv",
        name: "The 96th Academy Awards",
        genre_ids: [],
      }),
    ).toBe(true)
    expect(
      isTalkOrAwardsShow({
        id: 202,
        media_type: "tv",
        name: "Grammy Awards 2024",
        genre_ids: [],
      }),
    ).toBe(true)
    expect(
      isTalkOrAwardsShow({
        id: 203,
        media_type: "tv",
        name: "Primetime Emmy Awards",
        genre_ids: [],
      }),
    ).toBe(true)
  })

  it("keeps ceremony coverage after tightening name-colliding patterns", () => {
    // Bare plurals are ceremony-specific and still match alone.
    for (const name of [
      "Oscars 2024",
      "The Oscars 2026",
      "Emmys 2024",
      "The Tonys",
      "Tonys 2024",
    ]) {
      expect(
        isTalkOrAwardsShow({ id: 210, media_type: "tv", name, genre_ids: [] }),
      ).toBe(true)
    }
    // Singular forms still match with ceremony context.
    for (const name of [
      "Oscar Night",
      "Oscar Nominations 2024",
      "68th Academy Awards",
      "Emmy Awards",
      "Tony Ceremony",
    ]) {
      expect(
        isTalkOrAwardsShow({ id: 211, media_type: "tv", name, genre_ids: [] }),
      ).toBe(true)
    }
  })

  it("does not misclassify scripted titles with award-adjacent names", () => {
    // Oscar, Emmy and Tony are also personal names — without ceremony
    // context (or the bare plural) they must not match.
    for (const name of [
      "Oscar's Oasis",
      "Emmy",
      "Tony",
      "Tony's Diner",
    ]) {
      expect(
        isTalkOrAwardsShow({ id: 220, media_type: "tv", name, genre_ids: [18] }),
      ).toBe(false)
    }
  })

  it("never matches movies — Oscar winners stay visible", () => {
    expect(
      isTalkOrAwardsShow({
        id: 300,
        media_type: "movie",
        title: "Oppenheimer",
        genre_ids: [18],
      }),
    ).toBe(false)
    // Even a movie literally about the Oscars never matches.
    expect(
      isTalkOrAwardsShow({
        id: 301,
        media_type: "movie",
        title: "The Oscars",
        genre_ids: [18],
      }),
    ).toBe(false)
  })

  it("never matches persons", () => {
    expect(
      isTalkOrAwardsShow({
        id: 400,
        media_type: "person",
        name: "Jimmy Fallon",
      }),
    ).toBe(false)
  })

  it("fails open on missing fields", () => {
    expect(isTalkOrAwardsShow(null)).toBe(false)
    expect(isTalkOrAwardsShow(undefined)).toBe(false)
    expect(
      isTalkOrAwardsShow({ id: 500, media_type: "tv" }),
    ).toBe(false)
  })
})

describe("filterNonScriptedTV", () => {
  const scripted = {
    id: 1,
    media_type: "tv",
    name: "The West Wing",
    genre_ids: [18],
  }
  const talk = {
    id: 2,
    media_type: "tv",
    name: "The Tonight Show Starring Jimmy Fallon",
    genre_ids: [10767],
  }

  it("removes talk shows when enabled", () => {
    expect(filterNonScriptedTV([scripted, talk], true)).toEqual([scripted])
  })

  it("returns the identical array reference when disabled", () => {
    const items = [scripted, talk]
    expect(filterNonScriptedTV(items, false)).toBe(items)
  })

  it("returns the identical array reference when nothing matches", () => {
    const items = [scripted]
    expect(filterNonScriptedTV(items, true)).toBe(items)
  })

  it("returns the identical array reference for empty input", () => {
    const items: typeof scripted[] = []
    expect(filterNonScriptedTV(items, true)).toBe(items)
  })
})
