"use client"

import {
  getListItemCandidateKeys,
  type ListItemMediaType,
} from "@/lib/list-item-keys"
import type { ListMediaItem, ListWriteMediaItem, UserList } from "@/types/list"

export function addItemToCachedLists(
  lists: UserList[],
  listId: string,
  mediaItem: ListWriteMediaItem,
): UserList[] {
  const itemKey = String(mediaItem.id)
  const addedItem: ListMediaItem = {
    ...mediaItem,
    addedAt: mediaItem.addedAt ?? Date.now(),
  }

  return lists.map((list) => {
    if (list.id !== listId) return list

    return {
      ...list,
      items: {
        ...(list.items || {}),
        [itemKey]: addedItem,
      },
      updatedAt: Date.now(),
    }
  })
}

export function removeItemFromCachedLists(
  lists: UserList[],
  listId: string,
  mediaId: string,
): UserList[] {
  return lists.map((list) => {
    if (list.id !== listId) return list

    const nextItems = { ...(list.items || {}) }
    delete nextItems[mediaId]

    return {
      ...list,
      items: nextItems,
      updatedAt: Date.now(),
    }
  })
}

export function removeMediaFromCachedLists(
  lists: UserList[],
  listId: string,
  mediaId: number,
  mediaType: ListItemMediaType,
): UserList[] {
  const candidateKeys = getListItemCandidateKeys(mediaType, mediaId)

  return lists.map((list) => {
    if (list.id !== listId) return list

    const nextItems = { ...(list.items || {}) }

    candidateKeys.forEach((itemKey) => {
      delete nextItems[itemKey]
    })

    return {
      ...list,
      items: nextItems,
      updatedAt: Date.now(),
    }
  })
}

export function updateListInCachedLists(
  lists: UserList[],
  listId: string,
  newName: string,
  description?: string,
): UserList[] {
  const trimmedName = newName.trim()
  const hasDescriptionUpdate = description !== undefined
  const trimmedDescription = description?.trim()

  return lists.map((list) => {
    if (list.id !== listId) return list

    const nextList: UserList = {
      ...list,
      name: trimmedName,
      updatedAt: Date.now(),
    }

    if (hasDescriptionUpdate) {
      if (trimmedDescription) {
        nextList.description = trimmedDescription
      } else {
        delete nextList.description
      }
    }

    return nextList
  })
}
