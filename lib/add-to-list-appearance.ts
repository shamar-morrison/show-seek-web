import { isDefaultList, type UserList } from "@/types/list"
import { hasStoredListItem } from "@/lib/list-item-keys"
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

export type AddToListAppearanceVariant = "none" | "single" | "multiple"
export type AddToListActionIcon = typeof PlusSignIcon
export type AddToListActionIconKey =
  | "plus"
  | "watchlist"
  | "currently-watching"
  | "already-watched"
  | "favorites"
  | "dropped"
  | "custom"
  | "multiple"

export interface AddToListAppearance {
  listIds: string[]
  variant: AddToListAppearanceVariant
  isInAnyList: boolean
  icon: AddToListActionIcon
  iconKey: AddToListActionIconKey
  buttonClassName: string
  dropdownIconClassName: string
}

interface AddToListAppearanceConfig {
  icon: AddToListActionIcon
  iconKey: AddToListActionIconKey
  buttonClassName: string
  dropdownIconClassName: string
}

const NO_LIST_APPEARANCE: AddToListAppearanceConfig = {
  icon: PlusSignIcon,
  iconKey: "plus",
  buttonClassName: "",
  dropdownIconClassName: "",
}

// Colors mirror the mobile app's `getListColor` / `MULTIPLE_LISTS_COLOR`
// (`show-seek/src/utils/listIcons.ts`). Background is 15% alpha and border is
// 50% alpha, matching mobile's `hexToRGBA` glass tint.
const MULTIPLE_LISTS_APPEARANCE: AddToListAppearanceConfig = {
  icon: CheckListIcon,
  iconKey: "multiple",
  buttonClassName:
    "border-[#46D369]/50 bg-[#46D369]/15 text-white hover:border-[#46D369]/60 hover:bg-[#46D369]/25 hover:text-white dark:border-[#46D369]/50 dark:bg-[#46D369]/15 dark:hover:border-[#46D369]/60 dark:hover:bg-[#46D369]/25",
  // No fill: CheckListIcon is open stroke paths; filling would paint the
  // implicit closures instead of the check strokes.
  dropdownIconClassName: "text-[#46D369]",
}

// Mobile's `getListColor` default branch is blue (#3b82f6), used for custom
// and unrecognized list IDs.
const CUSTOM_LIST_APPEARANCE: AddToListAppearanceConfig = {
  icon: FolderLibraryIcon,
  iconKey: "custom",
  buttonClassName:
    "border-blue-500/50 bg-blue-500/15 text-white hover:border-blue-400/60 hover:bg-blue-500/25 hover:text-white dark:border-blue-500/50 dark:bg-blue-500/15 dark:hover:border-blue-400/60 dark:hover:bg-blue-500/25",
  dropdownIconClassName: "text-blue-500 fill-blue-500",
}

const DEFAULT_LIST_APPEARANCE: Record<string, AddToListAppearanceConfig> = {
  watchlist: {
    icon: Bookmark02Icon,
    iconKey: "watchlist",
    buttonClassName:
      "border-blue-500/50 bg-blue-500/15 text-white hover:border-blue-400/60 hover:bg-blue-500/25 hover:text-white dark:border-blue-500/50 dark:bg-blue-500/15 dark:hover:border-blue-400/60 dark:hover:bg-blue-500/25",
    dropdownIconClassName: "text-blue-500 fill-blue-500",
  },
  "currently-watching": {
    icon: PlayCircle02Icon,
    iconKey: "currently-watching",
    buttonClassName:
      "border-[#F57C00]/50 bg-[#F57C00]/15 text-white hover:border-[#F57C00]/60 hover:bg-[#F57C00]/25 hover:text-white dark:border-[#F57C00]/50 dark:bg-[#F57C00]/15 dark:hover:border-[#F57C00]/60 dark:hover:bg-[#F57C00]/25",
    dropdownIconClassName: "text-[#F57C00] fill-[#F57C00]",
  },
  "already-watched": {
    icon: Tick02Icon,
    iconKey: "already-watched",
    buttonClassName:
      "border-[#46D369]/50 bg-[#46D369]/15 text-white hover:border-[#46D369]/60 hover:bg-[#46D369]/25 hover:text-white dark:border-[#46D369]/50 dark:bg-[#46D369]/15 dark:hover:border-[#46D369]/60 dark:hover:bg-[#46D369]/25",
    // No fill: Tick02Icon is a single open stroke path; filling would paint
    // the implicit closure wedge instead of the check stroke.
    dropdownIconClassName: "text-[#46D369]",
  },
  favorites: {
    // `primary` tracks the user's accent color (default #E50914), matching
    // mobile's `getListColor('favorites', accentColor)`.
    icon: FavouriteIcon,
    iconKey: "favorites",
    buttonClassName:
      "border-primary/50 bg-primary/15 text-white hover:border-primary/60 hover:bg-primary/25 hover:text-white dark:border-primary/50 dark:bg-primary/15 dark:hover:border-primary/60 dark:hover:bg-primary/25",
    dropdownIconClassName: "text-primary fill-primary",
  },
  dropped: {
    icon: Cancel01Icon,
    iconKey: "dropped",
    buttonClassName:
      "border-gray-500/50 bg-gray-500/15 text-white hover:border-gray-400/60 hover:bg-gray-500/25 hover:text-white dark:border-gray-500/50 dark:bg-gray-500/15 dark:hover:border-gray-400/60 dark:hover:bg-gray-500/25",
    dropdownIconClassName: "text-gray-400",
  },
}

export function getMediaListIds(
  lists: UserList[],
  mediaId: number,
  mediaType: "movie" | "tv",
): string[] {
  return lists
    .filter((list) => hasStoredListItem(list.items, mediaType, mediaId))
    .map((list) => list.id)
}

function getSingleListAppearance(listId: string): AddToListAppearanceConfig {
  if (!isDefaultList(listId)) {
    return CUSTOM_LIST_APPEARANCE
  }

  return DEFAULT_LIST_APPEARANCE[listId] ?? CUSTOM_LIST_APPEARANCE
}

export function getAddToListAppearance(
  listIds: string[],
): AddToListAppearance {
  if (listIds.length === 0) {
    return {
      listIds,
      variant: "none",
      isInAnyList: false,
      ...NO_LIST_APPEARANCE,
    }
  }

  if (listIds.length > 1) {
    return {
      listIds,
      variant: "multiple",
      isInAnyList: true,
      ...MULTIPLE_LISTS_APPEARANCE,
    }
  }

  return {
    listIds,
    variant: "single",
    isInAnyList: true,
    ...getSingleListAppearance(listIds[0]),
  }
}

export function resolveAddToListAppearance(
  lists: UserList[],
  mediaId: number,
  mediaType: "movie" | "tv",
): AddToListAppearance {
  return getAddToListAppearance(getMediaListIds(lists, mediaId, mediaType))
}
