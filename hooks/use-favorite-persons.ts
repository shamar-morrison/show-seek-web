"use client"

import { useAuth } from "@/context/auth-context"
import {
  addFavoritePerson,
  FavoritePerson,
  fetchFavoritePersons,
  removeFavoritePerson,
} from "@/lib/firebase/favorite-persons"
import { queryCacheProfiles } from "@/lib/react-query/query-options"
import {
  queryKeys,
  UNAUTHENTICATED_USER_ID,
} from "@/lib/react-query/query-keys"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useMemo, useState } from "react"

function useFavoritePersonsRead(userId: string | null) {
  const favoritePersonsQueryKey = queryKeys.firestore.favoritePersons(
    userId ?? UNAUTHENTICATED_USER_ID,
  )

  const query = useQuery({
    ...queryCacheProfiles.profile,
    queryKey: favoritePersonsQueryKey,
    queryFn: async () => {
      if (!userId) return []
      return fetchFavoritePersons(userId)
    },
    enabled: !!userId,
  })

  return {
    favoritePersonsQueryKey,
    ...query,
  }
}

function useFavoritePersonMutations(
  userId: string | null,
  favoritePersonsQueryKey: readonly unknown[] | null,
) {
  const queryClient = useQueryClient()

  const addPersonMutation = useMutation({
    mutationFn: async (personData: Omit<FavoritePerson, "addedAt">) => {
      if (!userId) {
        throw new Error("Please sign in to add favorites")
      }

      await addFavoritePerson(userId, personData)
    },
    onMutate: async (personData) => {
      if (!favoritePersonsQueryKey) {
        return { previousPersons: undefined as FavoritePerson[] | undefined }
      }

      await queryClient.cancelQueries({ queryKey: favoritePersonsQueryKey })
      const previousPersons = queryClient.getQueryData<FavoritePerson[]>(
        favoritePersonsQueryKey,
      )

      const optimisticPerson: FavoritePerson = {
        ...personData,
        addedAt: Date.now(),
      }

      const nextPersons = [...(previousPersons ?? [])].filter(
        (person) => person.id !== optimisticPerson.id,
      )
      nextPersons.unshift(optimisticPerson)

      queryClient.setQueryData(favoritePersonsQueryKey, nextPersons)
      return { previousPersons }
    },
    onError: (_error, _variables, context) => {
      if (!favoritePersonsQueryKey) return
      if (context !== undefined) {
        queryClient.setQueryData(favoritePersonsQueryKey, context.previousPersons)
      }
    },
    onSettled: () => {
      if (!favoritePersonsQueryKey) return
      queryClient.invalidateQueries({ queryKey: favoritePersonsQueryKey })
    },
  })

  const removePersonMutation = useMutation({
    mutationFn: async (personId: number) => {
      if (!userId) {
        throw new Error("Please sign in to remove favorites")
      }

      await removeFavoritePerson(userId, personId)
    },
    onMutate: async (personId) => {
      if (!favoritePersonsQueryKey) {
        return { previousPersons: undefined as FavoritePerson[] | undefined }
      }

      await queryClient.cancelQueries({ queryKey: favoritePersonsQueryKey })
      const previousPersons = queryClient.getQueryData<FavoritePerson[]>(
        favoritePersonsQueryKey,
      )

      queryClient.setQueryData(
        favoritePersonsQueryKey,
        (previousPersons ?? []).filter((person) => person.id !== personId),
      )

      return { previousPersons }
    },
    onError: (_error, _variables, context) => {
      if (!favoritePersonsQueryKey) return
      if (context !== undefined) {
        queryClient.setQueryData(favoritePersonsQueryKey, context.previousPersons)
      }
    },
    onSettled: () => {
      if (!favoritePersonsQueryKey) return
      queryClient.invalidateQueries({ queryKey: favoritePersonsQueryKey })
    },
  })

  return { addPersonMutation, removePersonMutation }
}

/**
 * Hook for managing favorite persons with React Query caching and search.
 */
export function useFavoritePersons() {
  const { user, loading: authLoading } = useAuth()
  const [searchQuery, setSearchQuery] = useState("")

  const userId = user && !user.isAnonymous ? user.uid : null
  const {
    favoritePersonsQueryKey,
    data: persons = [],
    isLoading,
    error,
  } = useFavoritePersonsRead(userId)
  const { addPersonMutation, removePersonMutation } = useFavoritePersonMutations(
    userId,
    userId ? favoritePersonsQueryKey : null,
  )

  const filteredPersons = useMemo(() => {
    if (!searchQuery.trim()) return persons

    const query = searchQuery.toLowerCase()
    return persons.filter((person) => person.name.toLowerCase().includes(query))
  }, [persons, searchQuery])

  const { mutateAsync: removePerson } = removePersonMutation
  const { mutateAsync: addPerson } = addPersonMutation

  const isPersonFavorited = useCallback(
    (personId: number) => persons.some((p) => p.id === personId),
    [persons],
  )

  return {
    persons: filteredPersons,
    allPersons: persons,
    count: persons.length,
    loading: authLoading || (!!userId && isLoading),
    error: (error as Error | null) ?? null,
    searchQuery,
    setSearchQuery,
    removePerson,
    addPerson,
    isPersonFavorited,
  }
}

/**
 * Hook for checking if a specific person is favorited.
 */
export function useIsPersonFavorited(personId: number) {
  const { user, loading: authLoading } = useAuth()
  const userId = user && !user.isAnonymous ? user.uid : null
  const { data: persons = [], isLoading } = useFavoritePersonsRead(userId)

  return {
    isFavorited: persons.some((person) => person.id === personId),
    loading: authLoading || (!!userId && isLoading),
  }
}

/**
 * Hook for favorite person mutations with loading states.
 */
export function useFavoritePersonActions() {
  const { user } = useAuth()
  const userId = user && !user.isAnonymous ? user.uid : null
  const favoritePersonsQueryKey = userId
    ? queryKeys.firestore.favoritePersons(userId)
    : null
  const { addPersonMutation, removePersonMutation } = useFavoritePersonMutations(
    userId,
    favoritePersonsQueryKey,
  )

  return {
    addPerson: addPersonMutation.mutateAsync,
    removePerson: removePersonMutation.mutateAsync,
    isAdding: addPersonMutation.isPending,
    isRemoving: removePersonMutation.isPending,
    isAuthenticated: !!userId,
  }
}
