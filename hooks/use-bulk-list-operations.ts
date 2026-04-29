"use client"

import { useAuth } from "@/context/auth-context"
import { useOptionalTrakt } from "@/context/trakt-context"
import {
  addToList,
  deleteList,
  removeMediaFromList,
} from "@/lib/firebase/lists"
import {
  addItemToCachedLists,
  removeMediaFromCachedLists,
} from "@/lib/list-cache-updates"
import { hasStoredListItem } from "@/lib/list-item-keys"
import { queryKeys } from "@/lib/react-query/query-keys"
import { maybeWarnTraktManagedListEdit } from "@/lib/trakt-managed-edits"
import type { ListWriteMediaItem, UserList } from "@/types/list"
import { isDefaultList } from "@/types/list"
import { useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"
import { toast } from "sonner"

type BulkTransferMode = "copy" | "move"

interface TransferItemsParams {
  sourceListId: string
  targetListIds: string[]
  mediaItems: ListWriteMediaItem[]
  mode: BulkTransferMode
}

interface RemoveItemsParams {
  listId: string
  mediaItems: Array<Pick<ListWriteMediaItem, "id" | "media_type">>
  onProgress?: (processed: number, total: number) => void
}

interface DeleteListsParams {
  listIds: string[]
  onProgress?: (processed: number, total: number) => void
}

export interface BulkTransferResult {
  failedOperations: number
  totalOperations: number
}

export interface BulkRemoveItemsResult {
  failedItems: string[]
  total: number
}

export interface BulkDeleteListsResult {
  deletedIds: string[]
  failedIds: string[]
}

function getItemKey(item: Pick<ListWriteMediaItem, "id" | "media_type">) {
  return `${item.media_type}-${item.id}`
}

export function useBulkListOperations() {
  const { user } = useAuth()
  const trakt = useOptionalTrakt()
  const queryClient = useQueryClient()
  const userId = user && !user.isAnonymous ? user.uid : null
  const listQueryKey = userId ? queryKeys.firestore.lists(userId) : null
  const isTraktConnected = Boolean(trakt?.isConnected)

  const assertUserId = useCallback(() => {
    if (!userId) {
      throw new Error("User must be authenticated")
    }

    return userId
  }, [userId])

  const getCachedLists = useCallback(() => {
    if (!listQueryKey) {
      return undefined
    }

    return queryClient.getQueryData<UserList[]>(listQueryKey)
  }, [listQueryKey, queryClient])

  const setCachedLists = useCallback(
    (nextLists: UserList[]) => {
      if (!listQueryKey) {
        return
      }

      queryClient.setQueryData<UserList[]>(listQueryKey, nextLists)
    },
    [listQueryKey, queryClient],
  )

  const invalidateLists = useCallback(() => {
    if (!listQueryKey) {
      return
    }

    void queryClient.invalidateQueries({ queryKey: listQueryKey })
  }, [listQueryKey, queryClient])

  const transferItems = useCallback(
    async ({
      sourceListId,
      targetListIds,
      mediaItems,
      mode,
    }: TransferItemsParams): Promise<BulkTransferResult> => {
      const uid = assertUserId()
      const uniqueTargetIds = Array.from(new Set(targetListIds)).filter(
        (listId) => listId !== sourceListId,
      )

      if (mode === "move" && uniqueTargetIds.length === 0) {
        return {
          failedOperations: 0,
          totalOperations: 0,
        }
      }

      maybeWarnTraktManagedListEdit(
        isTraktConnected,
        [
          ...uniqueTargetIds,
          ...(mode === "move" ? [sourceListId] : []),
        ],
        toast.info,
      )

      let cachedLists = getCachedLists()
      let totalOperations = 0
      let failedOperations = 0

      for (const mediaItem of mediaItems) {
        let itemHadAddFailure = false

        for (const targetListId of uniqueTargetIds) {
          const targetList = cachedLists?.find((list) => list.id === targetListId)
          const alreadyInTarget = targetList
            ? hasStoredListItem(
                targetList.items,
                mediaItem.media_type,
                mediaItem.id,
              )
            : false

          if (alreadyInTarget) {
            continue
          }

          totalOperations += 1

          try {
            await addToList(uid, targetListId, mediaItem)
            if (cachedLists) {
              cachedLists = addItemToCachedLists(
                cachedLists,
                targetListId,
                mediaItem,
              )
              setCachedLists(cachedLists)
            }
          } catch {
            failedOperations += 1
            itemHadAddFailure = true
          }
        }

        if (mode === "copy" || itemHadAddFailure) {
          continue
        }

        totalOperations += 1

        try {
          await removeMediaFromList(
            uid,
            sourceListId,
            mediaItem.id,
            mediaItem.media_type,
          )
          if (cachedLists) {
            cachedLists = removeMediaFromCachedLists(
              cachedLists,
              sourceListId,
              mediaItem.id,
              mediaItem.media_type,
            )
            setCachedLists(cachedLists)
          }
        } catch {
          failedOperations += 1
        }
      }

      invalidateLists()

      return {
        failedOperations,
        totalOperations,
      }
    },
    [
      assertUserId,
      getCachedLists,
      invalidateLists,
      isTraktConnected,
      setCachedLists,
    ],
  )

  const removeItemsFromListBatch = useCallback(
    async ({
      listId,
      mediaItems,
      onProgress,
    }: RemoveItemsParams): Promise<BulkRemoveItemsResult> => {
      const uid = assertUserId()
      maybeWarnTraktManagedListEdit(isTraktConnected, [listId], toast.info)

      let cachedLists = getCachedLists()
      const failedItems: string[] = []
      const total = mediaItems.length
      let processed = 0

      for (const mediaItem of mediaItems) {
        try {
          await removeMediaFromList(
            uid,
            listId,
            mediaItem.id,
            mediaItem.media_type,
          )
          if (cachedLists) {
            cachedLists = removeMediaFromCachedLists(
              cachedLists,
              listId,
              mediaItem.id,
              mediaItem.media_type,
            )
            setCachedLists(cachedLists)
          }
        } catch {
          failedItems.push(getItemKey(mediaItem))
        } finally {
          processed += 1
          onProgress?.(processed, total)
        }
      }

      invalidateLists()

      return {
        failedItems,
        total,
      }
    },
    [
      assertUserId,
      getCachedLists,
      invalidateLists,
      isTraktConnected,
      setCachedLists,
    ],
  )

  const deleteListsBatch = useCallback(
    async ({
      listIds,
      onProgress,
    }: DeleteListsParams): Promise<BulkDeleteListsResult> => {
      const uid = assertUserId()
      const uniqueListIds = Array.from(new Set(listIds)).filter(
        (listId) => !isDefaultList(listId),
      )

      maybeWarnTraktManagedListEdit(isTraktConnected, uniqueListIds, toast.info)

      let cachedLists = getCachedLists()
      const deletedIds: string[] = []
      const failedIds: string[] = []
      const total = uniqueListIds.length
      let processed = 0

      for (const listId of uniqueListIds) {
        try {
          await deleteList(uid, listId)
          deletedIds.push(listId)
          if (cachedLists) {
            cachedLists = cachedLists.filter((list) => list.id !== listId)
            setCachedLists(cachedLists)
          }
        } catch {
          failedIds.push(listId)
        } finally {
          processed += 1
          onProgress?.(processed, total)
        }
      }

      invalidateLists()

      return {
        deletedIds,
        failedIds,
      }
    },
    [
      assertUserId,
      getCachedLists,
      invalidateLists,
      isTraktConnected,
      setCachedLists,
    ],
  )

  return {
    deleteListsBatch,
    removeItemsFromListBatch,
    transferItems,
  }
}
