import type { ListMediaItem } from "@/types/list"

export type ListItemMediaType = "movie" | "tv"

/**
 * Canonical prefixed key shape used by the shared cross-platform helpers.
 * The web app still writes numeric keys today, so read/remove helpers must
 * tolerate both formats during the transition.
 */
export function buildListItemKey(
  mediaType: ListItemMediaType,
  mediaId: number,
): string {
  return `${mediaType}-${mediaId}`
}

export function getLegacyListItemKey(mediaId: number): string {
  return String(mediaId)
}

/**
 * Keep the legacy numeric key first because current web writes still use it.
 */
export function getListItemCandidateKeys(
  mediaType: ListItemMediaType,
  mediaId: number,
): string[] {
  return [getLegacyListItemKey(mediaId), buildListItemKey(mediaType, mediaId)]
}

export function getStoredListItemEntry<T = ListMediaItem>(
  items: Record<string, T> | undefined,
  mediaType: ListItemMediaType,
  mediaId: number,
): { item: T; itemKey: string } | null {
  if (!items) {
    return null
  }

  for (const itemKey of getListItemCandidateKeys(mediaType, mediaId)) {
    const item = items[itemKey]

    if (item) {
      return {
        item,
        itemKey,
      }
    }
  }

  return null
}

export function hasStoredListItem(
  items: Record<string, unknown> | undefined,
  mediaType: ListItemMediaType,
  mediaId: number,
): boolean {
  return getStoredListItemEntry(items, mediaType, mediaId) !== null
}
