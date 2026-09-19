import {
  getMediaListIds,
  resolveAddToListAppearance,
} from "@/lib/add-to-list-appearance"
import type { ListMediaItem, UserList } from "@/types/list"
import {
  Bookmark02Icon,
  Cancel01Icon,
  CheckListIcon,
  FavouriteIcon,
  FolderLibraryIcon,
  PlayCircle02Icon,
  PlusSignIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"
import { describe, expect, it } from "vitest"

function createListMediaItem(): ListMediaItem {
  return {
    id: 123,
    title: "Test Title",
    poster_path: null,
    media_type: "movie",
    addedAt: 0,
  }
}

function createList(listId: string, itemKeys: string[]): UserList {
  return {
    id: listId,
    name: listId,
    items: Object.fromEntries(
      itemKeys.map((itemKey) => [itemKey, createListMediaItem()]),
    ),
    createdAt: 0,
    isCustom: ![
      "watchlist",
      "currently-watching",
      "already-watched",
      "favorites",
      "dropped",
    ].includes(listId),
  }
}

describe("add-to-list appearance", () => {
  it("returns the neutral plus state when the item is not in any list", () => {
    const appearance = resolveAddToListAppearance([], 123, "movie")

    expect(appearance).toMatchObject({
      listIds: [],
      variant: "none",
      isInAnyList: false,
      icon: PlusSignIcon,
      buttonClassName: "",
      dropdownIconClassName: "",
    })
  })

  it.each([
    ["watchlist", Bookmark02Icon, "border-blue-500/50"],
    ["currently-watching", PlayCircle02Icon, "border-[#F57C00]/50"],
    ["already-watched", Tick02Icon, "border-[#46D369]/50"],
    ["favorites", FavouriteIcon, "border-primary/50"],
    ["dropped", Cancel01Icon, "border-gray-500/50"],
  ] as const)(
    "returns the correct single-list appearance for %s",
    (listId, icon, className) => {
      const appearance = resolveAddToListAppearance(
        [createList(listId, ["123"])],
        123,
        "movie",
      )

      expect(appearance.listIds).toEqual([listId])
      expect(appearance.variant).toBe("single")
      expect(appearance.isInAnyList).toBe(true)
      expect(appearance.icon).toBe(icon)
      expect(appearance.buttonClassName).toContain(className)
    },
  )

  it("includes dark-mode color overrides so the tint beats Button outline", () => {
    const watchlist = resolveAddToListAppearance(
      [createList("watchlist", ["123"])],
      123,
      "movie",
    )
    expect(watchlist.buttonClassName).toContain("dark:border-blue-500/50")
    expect(watchlist.buttonClassName).toContain("dark:bg-blue-500/15")

    const watched = resolveAddToListAppearance(
      [createList("already-watched", ["123"])],
      123,
      "movie",
    )
    expect(watched.buttonClassName).toContain("dark:border-[#46D369]/50")
    expect(watched.buttonClassName).toContain("dark:bg-[#46D369]/15")

    const favorites = resolveAddToListAppearance(
      [createList("favorites", ["123"])],
      123,
      "movie",
    )
    expect(favorites.buttonClassName).toContain("dark:border-primary/50")
    expect(favorites.buttonClassName).toContain("dark:bg-primary/15")

    const custom = resolveAddToListAppearance(
      [createList("road-trip", ["123"])],
      123,
      "movie",
    )
    expect(custom.buttonClassName).toContain("dark:border-blue-500/50")

    const multiple = resolveAddToListAppearance(
      [createList("watchlist", ["123"]), createList("road-trip", ["123"])],
      123,
      "movie",
    )
    expect(multiple.buttonClassName).toContain("dark:border-[#46D369]/50")

    const none = resolveAddToListAppearance([], 123, "movie")
    expect(none.buttonClassName).not.toContain("dark:")
  })

  it("uses the custom-list folder styling for a single custom list", () => {
    const appearance = resolveAddToListAppearance(
      [createList("road-trip", ["123"])],
      123,
      "movie",
    )

    expect(appearance.listIds).toEqual(["road-trip"])
    expect(appearance.variant).toBe("single")
    expect(appearance.icon).toBe(FolderLibraryIcon)
    expect(appearance.buttonClassName).toContain("border-blue-500/50")
  })

  it("uses the mobile multiple-lists fallback when the item is in more than one list", () => {
    const appearance = resolveAddToListAppearance(
      [
        createList("watchlist", ["123"]),
        createList("road-trip", ["123"]),
      ],
      123,
      "movie",
    )

    expect(appearance.listIds).toEqual(["watchlist", "road-trip"])
    expect(appearance.variant).toBe("multiple")
    expect(appearance.icon).toBe(CheckListIcon)
    expect(appearance.buttonClassName).toContain("border-[#46D369]/50")
  })

  it("renders stroke-only dropdown icons for open-path check glyphs", () => {
    const watched = resolveAddToListAppearance(
      [createList("already-watched", ["123"])],
      123,
      "movie",
    )
    expect(watched.dropdownIconClassName).toContain("text-[#46D369]")
    expect(watched.dropdownIconClassName).not.toMatch(/fill-\S+/)

    const multiple = resolveAddToListAppearance(
      [
        createList("watchlist", ["123"]),
        createList("road-trip", ["123"]),
      ],
      123,
      "movie",
    )
    expect(multiple.dropdownIconClassName).toContain("text-[#46D369]")
    expect(multiple.dropdownIconClassName).not.toMatch(/fill-\S+/)
  })

  it("matches legacy prefixed keys when resolving membership", () => {
    const lists = [createList("watchlist", ["movie-123"])]

    expect(getMediaListIds(lists, 123, "movie")).toEqual(["watchlist"])

    const appearance = resolveAddToListAppearance(lists, 123, "movie")
    expect(appearance.icon).toBe(Bookmark02Icon)
    expect(appearance.variant).toBe("single")
  })
})
