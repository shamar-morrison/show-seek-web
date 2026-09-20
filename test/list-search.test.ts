import type { ListMediaItem } from "@/types/list"
import {
  ALL_LISTS_TAB_ID,
  countListQueryMatches,
  flattenListsForSearch,
  getListSearchKey,
  matchesListQuery,
  normalizeSearchQuery,
} from "@/lib/list-search"
import { describe, expect, it } from "vitest"

function createItem(
  overrides: Partial<ListMediaItem> & { id: number },
): ListMediaItem {
  return {
    title: `Title ${overrides.id}`,
    poster_path: null,
    media_type: "movie",
    addedAt: 0,
    ...overrides,
  }
}

const resolveTitle = (item: ListMediaItem): string =>
  item.title || item.name || ""

describe("list-search", () => {
  it("exposes the virtual All tab id", () => {
    expect(ALL_LISTS_TAB_ID).toBe("all")
  })

  it("normalizes queries by trimming and lowercasing", () => {
    expect(normalizeSearchQuery("  EndGame ")).toBe("endgame")
    expect(normalizeSearchQuery("")).toBe("")
  })

  it("keys identity by media type and TMDB id, never the raw map key", () => {
    expect(getListSearchKey({ id: 123, media_type: "movie" })).toBe(
      "movie-123",
    )
    expect(getListSearchKey({ id: 123, media_type: "tv" })).toBe("tv-123")
  })

  it("matches titles case-insensitively and matches everything on empty query", () => {
    const item = createItem({ id: 1, title: "Avengers: Endgame" })

    expect(matchesListQuery(item, "", resolveTitle)).toBe(true)
    expect(matchesListQuery(item, "endgame", resolveTitle)).toBe(true)
    expect(matchesListQuery(item, "avengers", resolveTitle)).toBe(true)
    expect(matchesListQuery(item, "batman", resolveTitle)).toBe(false)
  })

  it("dedupes a title across lists keeping the first list's item", () => {
    const watchlistItem = createItem({
      id: 1,
      title: "Dune",
      poster_path: "/dune-watchlist.jpg",
      addedAt: 10,
    })
    const favoritesItem = createItem({
      id: 1,
      title: "Dune",
      poster_path: "/dune-favorites.jpg",
      addedAt: 20,
    })

    const flattened = flattenListsForSearch([
      { id: "watchlist", items: { "movie-1": watchlistItem } },
      { id: "favorites", items: { "movie-1": favoritesItem } },
    ])

    expect(flattened).toHaveLength(1)
    expect(flattened[0]?.item.poster_path).toBe("/dune-watchlist.jpg")
    expect(flattened[0]?.listIds).toEqual(["watchlist", "favorites"])
  })

  it("keeps a movie and a TV show with the same id as separate entries", () => {
    const flattened = flattenListsForSearch([
      {
        id: "watchlist",
        items: {
          "123": createItem({ id: 123, media_type: "movie", title: "Movie 123" }),
          "tv-123": createItem({
            id: 123,
            media_type: "tv",
            title: "Show 123",
            name: "Show 123",
          }),
        },
      },
    ])

    expect(flattened).toHaveLength(2)
    expect(flattened.map((entry) => getListSearchKey(entry.item)).sort()).toEqual(
      ["movie-123", "tv-123"],
    )
  })

  it("merges legacy numeric keys by media identity, not raw key", () => {
    const flattened = flattenListsForSearch([
      { id: "watchlist", items: { "123": createItem({ id: 123 }) } },
      { id: "favorites", items: { "123": createItem({ id: 123 }) } },
    ])

    expect(flattened).toHaveLength(1)
    expect(flattened[0]?.listIds).toEqual(["watchlist", "favorites"])
  })

  it("counts per-list matches and raw totals on empty query", () => {
    const items = {
      "movie-1": createItem({ id: 1, title: "Avengers: Endgame" }),
      "movie-2": createItem({ id: 2, title: "The Batman" }),
    }

    expect(countListQueryMatches(items, "", resolveTitle)).toBe(2)
    expect(countListQueryMatches(items, "endgame", resolveTitle)).toBe(1)
    expect(countListQueryMatches(items, "nothing", resolveTitle)).toBe(0)
    expect(countListQueryMatches(undefined, "endgame", resolveTitle)).toBe(0)
  })

  it("uses the identical predicate for filtering and counting", () => {
    const shared = {
      "movie-1": createItem({ id: 1, title: "Avengers: Endgame" }),
    }
    const lists = [
      {
        id: "watchlist",
        items: {
          ...shared,
          "movie-2": createItem({ id: 2, title: "The Batman" }),
        },
      },
      {
        id: "favorites",
        items: {
          ...shared,
          "movie-3": createItem({ id: 3, title: "Endgame Rewatchables" }),
        },
      },
    ]
    const query = normalizeSearchQuery("EndGame")

    const flattened = flattenListsForSearch(lists)
    const filtered = flattened.filter((entry) =>
      matchesListQuery(entry.item, query, resolveTitle),
    )
    const perListTotal = lists.reduce(
      (sum, list) => sum + countListQueryMatches(list.items, query, resolveTitle),
      0,
    )

    // Two lists match, but the deduped All total counts shared titles once.
    expect(perListTotal).toBe(3)
    expect(filtered).toHaveLength(2)
    expect(filtered.map((entry) => entry.item.id).sort()).toEqual([1, 3])
  })
})
