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
    ["watchlist", Bookmark02Icon, "border-blue-400/40"],
    ["currently-watching", PlayCircle02Icon, "border-amber-400/40"],
    ["already-watched", Tick02Icon, "border-green-400/40"],
    ["favorites", FavouriteIcon, "border-rose-400/40"],
    ["dropped", Cancel01Icon, "border-slate-400/40"],
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

  it("uses the custom-list folder styling for a single custom list", () => {
    const appearance = resolveAddToListAppearance(
      [createList("road-trip", ["123"])],
      123,
      "movie",
    )

    expect(appearance.listIds).toEqual(["road-trip"])
    expect(appearance.variant).toBe("single")
    expect(appearance.icon).toBe(FolderLibraryIcon)
    expect(appearance.buttonClassName).toContain("border-violet-400/40")
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
    expect(appearance.buttonClassName).toContain("border-green-400/40")
  })

  it("matches legacy prefixed keys when resolving membership", () => {
    const lists = [createList("watchlist", ["movie-123"])]

    expect(getMediaListIds(lists, 123, "movie")).toEqual(["watchlist"])

    const appearance = resolveAddToListAppearance(lists, 123, "movie")
    expect(appearance.icon).toBe(Bookmark02Icon)
    expect(appearance.variant).toBe("single")
  })
})
