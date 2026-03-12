"use client"

import { isDefaultList, type UserList } from "@/types/list"
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

const MULTIPLE_LISTS_APPEARANCE: AddToListAppearanceConfig = {
  icon: CheckListIcon,
  iconKey: "multiple",
  buttonClassName:
    "border-green-400/40 bg-green-500/15 text-white hover:border-green-300/60 hover:bg-green-500/25 hover:text-white",
  dropdownIconClassName: "text-green-400 fill-green-400",
}

const CUSTOM_LIST_APPEARANCE: AddToListAppearanceConfig = {
  icon: FolderLibraryIcon,
  iconKey: "custom",
  buttonClassName:
    "border-violet-400/40 bg-violet-500/15 text-white hover:border-violet-300/60 hover:bg-violet-500/25 hover:text-white",
  dropdownIconClassName: "text-violet-400 fill-violet-400",
}

const DEFAULT_LIST_APPEARANCE: Record<string, AddToListAppearanceConfig> = {
  watchlist: {
    icon: Bookmark02Icon,
    iconKey: "watchlist",
    buttonClassName:
      "border-blue-400/40 bg-blue-500/15 text-white hover:border-blue-300/60 hover:bg-blue-500/25 hover:text-white",
    dropdownIconClassName: "text-blue-400 fill-blue-400",
  },
  "currently-watching": {
    icon: PlayCircle02Icon,
    iconKey: "currently-watching",
    buttonClassName:
      "border-amber-400/40 bg-amber-500/15 text-white hover:border-amber-300/60 hover:bg-amber-500/25 hover:text-white",
    dropdownIconClassName: "text-amber-400 fill-amber-400",
  },
  "already-watched": {
    icon: Tick02Icon,
    iconKey: "already-watched",
    buttonClassName:
      "border-green-400/40 bg-green-500/15 text-white hover:border-green-300/60 hover:bg-green-500/25 hover:text-white",
    dropdownIconClassName: "text-green-400 fill-green-400",
  },
  favorites: {
    icon: FavouriteIcon,
    iconKey: "favorites",
    buttonClassName:
      "border-rose-400/40 bg-rose-500/15 text-white hover:border-rose-300/60 hover:bg-rose-500/25 hover:text-white",
    dropdownIconClassName: "text-rose-400 fill-rose-400",
  },
  dropped: {
    icon: Cancel01Icon,
    iconKey: "dropped",
    buttonClassName:
      "border-slate-400/40 bg-slate-500/15 text-white hover:border-slate-300/60 hover:bg-slate-500/25 hover:text-white",
    dropdownIconClassName: "text-slate-300",
  },
}

export function getMediaListIds(
  lists: UserList[],
  mediaId: number,
  mediaType: "movie" | "tv",
): string[] {
  const numericKey = String(mediaId)
  const prefixedKey = `${mediaType}-${mediaId}`

  return lists
    .filter((list) => {
      const items = list.items
      return Boolean(items?.[numericKey] || items?.[prefixedKey])
    })
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
