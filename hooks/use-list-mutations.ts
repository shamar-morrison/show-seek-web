"use client"

import { useAuth } from "@/context/auth-context"
import {
  addToList as addToListInFirestore,
  createList as createListInFirestore,
  deleteList as deleteListInFirestore,
  removeFromList as removeFromListInFirestore,
  renameList as renameListInFirestore,
} from "@/lib/firebase/lists"
import { queryKeys } from "@/lib/react-query/query-keys"
import { DEFAULT_LISTS, type ListMediaItem, type UserList } from "@/types/list"
import { useMutation, useQueryClient } from "@tanstack/react-query"

type ListItemInput = Omit<ListMediaItem, "addedAt">

function addItemToCachedLists(
  lists: UserList[],
  listId: string,
  mediaItem: ListItemInput,
): UserList[] {
  const itemKey = String(mediaItem.id)
  const addedItem: ListMediaItem = {
    ...mediaItem,
    addedAt: Date.now(),
  }

  const existing = lists.find((list) => list.id === listId)
  if (!existing) {
    const defaultList = DEFAULT_LISTS.find((list) => list.id === listId)
    if (!defaultList) return lists

    return [
      ...lists,
      {
        id: listId,
        name: defaultList.name,
        items: {
          [itemKey]: addedItem,
        },
        createdAt: Date.now(),
        isCustom: false,
      },
    ]
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

function removeItemFromCachedLists(
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

function assertUserId(userId: string | null): string {
  if (!userId) {
    throw new Error("User must be authenticated")
  }
  return userId
}

export function useListMutations() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const userId = user && !user.isAnonymous ? user.uid : null
  const listQueryKey = userId ? queryKeys.firestore.lists(userId) : null

  type ListMutationContext<TExtra extends object = Record<string, never>> = {
    previousLists: UserList[] | undefined
  } & TExtra

  function useListOptimisticMutation<TVariables, TResult, TExtra extends object = Record<string, never>>({
    mutationFn,
    optimisticUpdate,
  }: {
    mutationFn: (variables: TVariables) => Promise<TResult>
    optimisticUpdate: (params: {
      previousLists: UserList[] | undefined
      variables: TVariables
    }) => { nextLists?: UserList[]; extraContext?: TExtra }
  }) {
    return useMutation<TResult, Error, TVariables, ListMutationContext<TExtra>>({
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
    })
  }

  const addToListMutation = useListOptimisticMutation({
    mutationFn: async ({ listId, mediaItem }: { listId: string; mediaItem: ListItemInput }) => {
      const uid = assertUserId(userId)
      return addToListInFirestore(uid, listId, mediaItem)
    },
    optimisticUpdate: ({ previousLists, variables }) => {
      if (!previousLists) return {}
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
    mutationFn: async ({ listId, mediaId }: { listId: string; mediaId: string }) => {
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

  const createListMutation = useListOptimisticMutation<
    { name: string },
    string,
    { optimisticId: string }
  >({
    mutationFn: async ({ name }) => {
      const uid = assertUserId(userId)
      return createListInFirestore(uid, name)
    },
    optimisticUpdate: ({ previousLists, variables }) => {
      const optimisticId = `temp-${Date.now()}`

      if (!previousLists) {
        return { extraContext: { optimisticId } }
      }

      return {
        nextLists: [
          ...previousLists,
          {
            id: optimisticId,
            name: variables.name,
            items: {},
            createdAt: Date.now(),
            isCustom: true,
          },
        ],
        extraContext: { optimisticId },
      }
    },
  })

  const renameListMutation = useListOptimisticMutation({
    mutationFn: async ({ listId, newName }: { listId: string; newName: string }) => {
      const uid = assertUserId(userId)
      return renameListInFirestore(uid, listId, newName)
    },
    optimisticUpdate: ({ previousLists, variables }) => {
      if (!previousLists) return {}
      return {
        nextLists: previousLists.map((list) =>
          list.id === variables.listId ? { ...list, name: variables.newName } : list,
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

  return {
    addToList: async (listId: string, mediaItem: ListItemInput) =>
      addToListMutation.mutateAsync({ listId, mediaItem }),
    removeFromList: async (listId: string, mediaId: string) =>
      removeFromListMutation.mutateAsync({ listId, mediaId }),
    createList: async (name: string) => createListMutation.mutateAsync({ name }),
    renameList: async (listId: string, newName: string) =>
      renameListMutation.mutateAsync({ listId, newName }),
    deleteList: async (listId: string) =>
      deleteListMutation.mutateAsync({ listId }),
    isMutating:
      addToListMutation.isPending ||
      removeFromListMutation.isPending ||
      createListMutation.isPending ||
      renameListMutation.isPending ||
      deleteListMutation.isPending,
  }
}
