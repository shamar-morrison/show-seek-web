import type { ListMediaItem } from "@/types/list"

/** Virtual tab id for the cross-list "All" view (not a Firestore list). */
export const ALL_LISTS_TAB_ID = "all"

/**
 * Normalize a raw search string for title matching.
 * Trims whitespace so trailing spaces can't silently break matches.
 */
export function normalizeSearchQuery(query: string): string {
  return query.trim().toLowerCase()
}

/**
 * Strip combining diacritical marks so user-typed names match
 * accent-insensitively ("cafe" matches "café", "Zoe" matches "Zoë").
 */
export function foldDiacritics(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
}

/**
 * Match a user-typed list name against a query: trim, lowercase, fold
 * diacritics on both sides, then substring-match.
 */
export function matchesListName(name: string, query: string): boolean {
  const normalizedQuery = foldDiacritics(query.trim().toLowerCase())

  if (!normalizedQuery) {
    return true
  }

  return foldDiacritics(name.toLowerCase()).includes(normalizedQuery)
}

/**
 * Identity key for cross-list dedupe. Uses the item's media_type + TMDB id
 * fields and never the raw map key, because legacy numeric keys collide
 * across movies and TV shows sharing an id.
 */
export function getListSearchKey(
  item: Pick<ListMediaItem, "id" | "media_type">,
): string {
  return `${item.media_type}-${item.id}`
}

/** Resolves the display title used for matching (e.g. getItemDisplayTitle). */
export type ListSearchTitleResolver = (item: ListMediaItem) => string

/**
 * Shared title-match predicate. Used for both filtering and per-tab counts
 * so the two can never drift apart.
 */
export function matchesListQuery(
  item: ListMediaItem,
  normalizedQuery: string,
  resolveTitle: ListSearchTitleResolver,
): boolean {
  if (!normalizedQuery) {
    return true
  }

  return resolveTitle(item).toLowerCase().includes(normalizedQuery)
}

export interface FlattenedListSearchItem {
  item: ListMediaItem
  /** Ids of every list containing this title, in first-seen (tab) order. */
  listIds: string[]
}

interface UserListLike {
  id: string
  items?: Record<string, ListMediaItem> | null
}

/**
 * Flatten several lists into one deduped array for the "All" view. When a
 * title appears in more than one list, the item from the first list in tab
 * order wins for card data and every containing list id is collected.
 */
export function flattenListsForSearch(
  lists: Array<UserListLike>,
): FlattenedListSearchItem[] {
  const byKey = new Map<string, FlattenedListSearchItem>()

  for (const list of lists) {
    for (const item of Object.values(list.items ?? {})) {
      const key = getListSearchKey(item)
      const existing = byKey.get(key)

      if (existing) {
        if (!existing.listIds.includes(list.id)) {
          existing.listIds.push(list.id)
        }
      } else {
        byKey.set(key, { item, listIds: [list.id] })
      }
    }
  }

  return [...byKey.values()]
}

/**
 * Count title matches in a single list's items. An empty query returns the
 * raw total, matching getItemCount.
 */
export function countListQueryMatches(
  items: Record<string, ListMediaItem> | undefined | null,
  normalizedQuery: string,
  resolveTitle: ListSearchTitleResolver,
): number {
  const values = Object.values(items ?? {})

  if (!normalizedQuery) {
    return values.length
  }

  let count = 0
  for (const item of values) {
    if (matchesListQuery(item, normalizedQuery, resolveTitle)) {
      count++
    }
  }

  return count
}
