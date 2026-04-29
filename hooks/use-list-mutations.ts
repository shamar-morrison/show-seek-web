"use client"

import { useAuth } from "@/context/auth-context"
import { useOptionalTrakt } from "@/context/trakt-context"
import {
  addToList as addToListInFirestore,
  createList as createListInFirestore,
  deleteList as deleteListInFirestore,
  removeMediaFromList as removeMediaFromListInFirestore,
  removeFromList as removeFromListInFirestore,
  updateList as updateListInFirestore,
} from "@/lib/firebase/lists"
import {
  buildListItemKey,
  type ListItemMediaType,
} from "@/lib/list-item-keys"
import {
  addItemToCachedLists,
  removeItemFromCachedLists,
  removeMediaFromCachedLists,
  updateListInCachedLists,
} from "@/lib/list-cache-updates"
import { queryKeys } from "@/lib/react-query/query-keys"
import { maybeWarnTraktManagedListEdit } from "@/lib/trakt-managed-edits"
import {
  DEFAULT_LISTS,
  type ListWriteMediaItem,
  type UserList,
} from "@/types/list"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

function assertUserId(userId: string | null): string {
  if (!userId) {
    throw new Error("User must be authenticated")
  }
  return userId
}

export function useListMutations() {
  const { user } = useAuth()
  const trakt = useOptionalTrakt()
  const queryClient = useQueryClient()
  const userId = user && !user.isAnonymous ? user.uid : null
  const listQueryKey = userId ? queryKeys.firestore.lists(userId) : null
  const isTraktConnected = Boolean(trakt?.isConnected)

  type ListMutationContext<TExtra extends object = Record<string, never>> = {
    previousLists: UserList[] | undefined
  } & TExtra

  function useListOptimisticMutation<
    TVariables,
    TResult,
    TExtra extends object = Record<string, never>,
  >({
    mutationFn,
    optimisticUpdate,
  }: {
    mutationFn: (variables: TVariables) => Promise<TResult>
    optimisticUpdate: (params: {
      previousLists: UserList[] | undefined
      variables: TVariables
    }) => { nextLists?: UserList[]; extraContext?: TExtra }
  }) {
    return useMutation<TResult, Error, TVariables, ListMutationContext<TExtra>>(
      {
        mutationFn,
        onMutate: async (variables) => {
          let previousLists: UserList[] | undefined

          if (listQueryKey) {
            await queryClient.cancelQueries({ queryKey: listQueryKey })
            previousLists = queryClient.getQueryData<UserList[]>(listQueryKey)
          }

          const { nextLists, extraContext } = optimisticUpdate({
            previousLists,
            variables,
          })

          if (listQueryKey && nextLists !== undefined) {
            queryClient.setQueryData<UserList[]>(listQueryKey, nextLists)
          }

          return {
            previousLists,
            ...(extraContext ?? ({} as TExtra)),
          }
        },
        onError: (_error, _variables, context) => {
          if (!listQueryKey) return
          if (context !== undefined) {
            queryClient.setQueryData(listQueryKey, context.previousLists)
          }
        },
        onSettled: () => {
          if (!listQueryKey) return
          queryClient.invalidateQueries({ queryKey: listQueryKey })
        },
      },
    )
  }

  const addToListMutation = useListOptimisticMutation({
    mutationFn: async ({
      listId,
      mediaItem,
    }: {
      listId: string
      mediaItem: ListWriteMediaItem
    }) => {
      const uid = assertUserId(userId)
      return addToListInFirestore(uid, listId, mediaItem)
    },
    optimisticUpdate: ({ previousLists, variables }) => {
      if (!previousLists) return {}
      const existing = previousLists.find((list) => list.id === variables.listId)
      if (!existing) {
        const defaultList = DEFAULT_LISTS.find(
          (list) => list.id === variables.listId,
        )
        if (!defaultList) {
          return {}
        }

        const itemKey = buildListItemKey(
          variables.mediaItem.media_type,
          variables.mediaItem.id,
        )

        return {
          nextLists: [
            ...previousLists,
            {
              id: variables.listId,
              name: defaultList.name,
              items: {
                [itemKey]: {
                  ...variables.mediaItem,
                  addedAt: variables.mediaItem.addedAt ?? Date.now(),
                },
              },
              createdAt: Date.now(),
              isCustom: false,
            },
          ],
        }
      }

      return {
        nextLists: addItemToCachedLists(
          previousLists,
          variables.listId,
          variables.mediaItem,
        ),
      }
    },
  })

  const removeFromListMutation = useListOptimisticMutation({
    mutationFn: async ({
      listId,
      mediaId,
    }: {
      listId: string
      mediaId: string
    }) => {
      const uid = assertUserId(userId)
      return removeFromListInFirestore(uid, listId, mediaId)
    },
    optimisticUpdate: ({ previousLists, variables }) => {
      if (!previousLists) return {}
      return {
        nextLists: removeItemFromCachedLists(
          previousLists,
          variables.listId,
          variables.mediaId,
        ),
      }
    },
  })

  const removeMediaFromListMutation = useListOptimisticMutation({
    mutationFn: async ({
      listId,
      mediaId,
      mediaType,
    }: {
      listId: string
      mediaId: number
      mediaType: ListItemMediaType
    }) => {
      const uid = assertUserId(userId)
      return removeMediaFromListInFirestore(uid, listId, mediaId, mediaType)
    },
    optimisticUpdate: ({ previousLists, variables }) => {
      if (!previousLists) return {}
      return {
        nextLists: removeMediaFromCachedLists(
          previousLists,
          variables.listId,
          variables.mediaId,
          variables.mediaType,
        ),
      }
    },
  })

  const createListMutation = useListOptimisticMutation<
    { name: string; description?: string },
    string,
    { optimisticId: string }
  >({
    mutationFn: async ({ name, description }) => {
      const uid = assertUserId(userId)
      return createListInFirestore(uid, name, description)
    },
    optimisticUpdate: ({ previousLists, variables }) => {
      const optimisticId = `temp-${Date.now()}`
      const description = variables.description?.trim()

      if (!previousLists) {
        return { extraContext: { optimisticId } }
      }

      return {
        nextLists: [
          ...previousLists,
          {
            id: optimisticId,
            name: variables.name,
            description: description ? description : undefined,
            items: {},
            createdAt: Date.now(),
            isCustom: true,
          },
        ],
        extraContext: { optimisticId },
      }
    },
  })

  const updateListMutation = useListOptimisticMutation({
    mutationFn: async ({
      listId,
      newName,
      description,
    }: {
      listId: string
      newName: string
      description?: string
    }) => {
      const uid = assertUserId(userId)
      return updateListInFirestore(uid, listId, newName, description)
    },
    optimisticUpdate: ({ previousLists, variables }) => {
      if (!previousLists) return {}
      return {
        nextLists: updateListInCachedLists(
          previousLists,
          variables.listId,
          variables.newName,
          variables.description,
        ),
      }
    },
  })

  const deleteListMutation = useListOptimisticMutation({
    mutationFn: async ({ listId }: { listId: string }) => {
      const uid = assertUserId(userId)
      return deleteListInFirestore(uid, listId)
    },
    optimisticUpdate: ({ previousLists, variables }) => {
      if (!previousLists) return {}
      return {
        nextLists: previousLists.filter((list) => list.id !== variables.listId),
      }
    },
  })

  const updateList = async (
    listId: string,
    newName: string,
    description?: string,
  ) => {
    maybeWarnTraktManagedListEdit(isTraktConnected, [listId], toast.info)
    return updateListMutation.mutateAsync({ listId, newName, description })
  }

  return {
    addToList: async (listId: string, mediaItem: ListWriteMediaItem) => {
      maybeWarnTraktManagedListEdit(isTraktConnected, [listId], toast.info)
      return addToListMutation.mutateAsync({ listId, mediaItem })
    },
    removeFromList: async (listId: string, mediaId: string) => {
      maybeWarnTraktManagedListEdit(isTraktConnected, [listId], toast.info)
      return removeFromListMutation.mutateAsync({ listId, mediaId })
    },
    removeMediaFromList: async (
      listId: string,
      mediaId: number,
      mediaType: ListItemMediaType,
    ) => {
      maybeWarnTraktManagedListEdit(isTraktConnected, [listId], toast.info)
      return removeMediaFromListMutation.mutateAsync({
        listId,
        mediaId,
        mediaType,
      })
    },
    createList: async (name: string, description?: string) =>
      createListMutation.mutateAsync({ name, description }),
    updateList,
    renameList: updateList,
    deleteList: async (listId: string) => {
      maybeWarnTraktManagedListEdit(isTraktConnected, [listId], toast.info)
      return deleteListMutation.mutateAsync({ listId })
    },
    isMutating:
      addToListMutation.isPending ||
      removeFromListMutation.isPending ||
      removeMediaFromListMutation.isPending ||
      createListMutation.isPending ||
      updateListMutation.isPending ||
      deleteListMutation.isPending,
  }
}
