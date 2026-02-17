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

function assertUserId(userId: string | undefined): string {
  if (!userId) {
    throw new Error("User must be authenticated")
  }
  return userId
}

export function useListMutations() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const userId = user?.isAnonymous ? undefined : user?.uid
  const listQueryKey = userId ? queryKeys.firestore.lists(userId) : null

  const addToListMutation = useMutation({
    mutationFn: async ({ listId, mediaItem }: { listId: string; mediaItem: ListItemInput }) => {
      const uid = assertUserId(userId)
      return addToListInFirestore(uid, listId, mediaItem)
    },
    onMutate: async ({ listId, mediaItem }) => {
      if (!listQueryKey) return { previousLists: undefined as UserList[] | undefined }

      await queryClient.cancelQueries({ queryKey: listQueryKey })
      const previousLists = queryClient.getQueryData<UserList[]>(listQueryKey)

      if (previousLists) {
        queryClient.setQueryData<UserList[]>(
          listQueryKey,
          addItemToCachedLists(previousLists, listId, mediaItem),
        )
      }

      return { previousLists }
    },
    onError: (_error, _variables, context) => {
      if (!listQueryKey) return
      if (context?.previousLists) {
        queryClient.setQueryData(listQueryKey, context.previousLists)
      }
    },
    onSettled: () => {
      if (!listQueryKey) return
      queryClient.invalidateQueries({ queryKey: listQueryKey })
    },
  })

  const removeFromListMutation = useMutation({
    mutationFn: async ({ listId, mediaId }: { listId: string; mediaId: string }) => {
      const uid = assertUserId(userId)
      return removeFromListInFirestore(uid, listId, mediaId)
    },
    onMutate: async ({ listId, mediaId }) => {
      if (!listQueryKey) return { previousLists: undefined as UserList[] | undefined }

      await queryClient.cancelQueries({ queryKey: listQueryKey })
      const previousLists = queryClient.getQueryData<UserList[]>(listQueryKey)

      if (previousLists) {
        queryClient.setQueryData<UserList[]>(
          listQueryKey,
          removeItemFromCachedLists(previousLists, listId, mediaId),
        )
      }

      return { previousLists }
    },
    onError: (_error, _variables, context) => {
      if (!listQueryKey) return
      if (context?.previousLists) {
        queryClient.setQueryData(listQueryKey, context.previousLists)
      }
    },
    onSettled: () => {
      if (!listQueryKey) return
      queryClient.invalidateQueries({ queryKey: listQueryKey })
    },
  })

  const createListMutation = useMutation({
    mutationFn: async ({ name }: { name: string }) => {
      const uid = assertUserId(userId)
      return createListInFirestore(uid, name)
    },
    onMutate: async ({ name }) => {
      if (!listQueryKey) {
        return {
          previousLists: undefined as UserList[] | undefined,
          optimisticId: "",
        }
      }

      await queryClient.cancelQueries({ queryKey: listQueryKey })
      const previousLists = queryClient.getQueryData<UserList[]>(listQueryKey)
      const optimisticId = `temp-${Date.now()}`

      if (previousLists) {
        queryClient.setQueryData<UserList[]>(listQueryKey, [
          ...previousLists,
          {
            id: optimisticId,
            name,
            items: {},
            createdAt: Date.now(),
            isCustom: true,
          },
        ])
      }

      return { previousLists, optimisticId }
    },
    onError: (_error, _variables, context) => {
      if (!listQueryKey) return
      if (context?.previousLists) {
        queryClient.setQueryData(listQueryKey, context.previousLists)
      }
    },
    onSettled: () => {
      if (!listQueryKey) return
      queryClient.invalidateQueries({ queryKey: listQueryKey })
    },
  })

  const renameListMutation = useMutation({
    mutationFn: async ({ listId, newName }: { listId: string; newName: string }) => {
      const uid = assertUserId(userId)
      return renameListInFirestore(uid, listId, newName)
    },
    onMutate: async ({ listId, newName }) => {
      if (!listQueryKey) return { previousLists: undefined as UserList[] | undefined }

      await queryClient.cancelQueries({ queryKey: listQueryKey })
      const previousLists = queryClient.getQueryData<UserList[]>(listQueryKey)

      if (previousLists) {
        queryClient.setQueryData<UserList[]>(
          listQueryKey,
          previousLists.map((list) =>
            list.id === listId ? { ...list, name: newName } : list,
          ),
        )
      }

      return { previousLists }
    },
    onError: (_error, _variables, context) => {
      if (!listQueryKey) return
      if (context?.previousLists) {
        queryClient.setQueryData(listQueryKey, context.previousLists)
      }
    },
    onSettled: () => {
      if (!listQueryKey) return
      queryClient.invalidateQueries({ queryKey: listQueryKey })
    },
  })

  const deleteListMutation = useMutation({
    mutationFn: async ({ listId }: { listId: string }) => {
      const uid = assertUserId(userId)
      return deleteListInFirestore(uid, listId)
    },
    onMutate: async ({ listId }) => {
      if (!listQueryKey) return { previousLists: undefined as UserList[] | undefined }

      await queryClient.cancelQueries({ queryKey: listQueryKey })
      const previousLists = queryClient.getQueryData<UserList[]>(listQueryKey)

      if (previousLists) {
        queryClient.setQueryData<UserList[]>(
          listQueryKey,
          previousLists.filter((list) => list.id !== listId),
        )
      }

      return { previousLists }
    },
    onError: (_error, _variables, context) => {
      if (!listQueryKey) return
      if (context?.previousLists) {
        queryClient.setQueryData(listQueryKey, context.previousLists)
      }
    },
    onSettled: () => {
      if (!listQueryKey) return
      queryClient.invalidateQueries({ queryKey: listQueryKey })
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
