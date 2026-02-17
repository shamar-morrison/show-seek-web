"use client"

import { useAuth } from "@/context/auth-context"
import {
  addFavoritePerson,
  FavoritePerson,
  fetchFavoritePersons,
  removeFavoritePerson,
} from "@/lib/firebase/favorite-persons"
import { queryCacheProfiles } from "@/lib/react-query/query-options"
import { queryKeys } from "@/lib/react-query/query-keys"
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { useCallback, useMemo, useState } from "react"

/**
 * Hook for managing favorite persons with React Query caching and search.
 */
export function useFavoritePersons() {
  const { user, loading: authLoading } = useAuth()
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState("")

  const userId = user && !user.isAnonymous ? user.uid : null
  const favoritePersonsQueryKey = userId
    ? queryKeys.firestore.favoritePersons(userId)
    : null

  const {
    data: persons = [],
    isLoading,
    error,
  } = useQuery({
    ...queryCacheProfiles.profile,
    queryKey: favoritePersonsQueryKey ?? ["firestore", "favorite-persons", "guest"],
    queryFn: async () => {
      if (!userId) return []
      return fetchFavoritePersons(userId)
    },
    enabled: !!userId,
  })

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
      if (context?.previousPersons) {
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
      if (context?.previousPersons) {
        queryClient.setQueryData(favoritePersonsQueryKey, context.previousPersons)
      }
    },
    onSettled: () => {
      if (!favoritePersonsQueryKey) return
      queryClient.invalidateQueries({ queryKey: favoritePersonsQueryKey })
    },
  })

  const filteredPersons = useMemo(() => {
    if (!searchQuery.trim()) return persons

    const query = searchQuery.toLowerCase()
    return persons.filter((person) => person.name.toLowerCase().includes(query))
  }, [persons, searchQuery])

  const removePerson = useCallback(
    async (personId: number) => {
      await removePersonMutation.mutateAsync(personId)
    },
    [removePersonMutation],
  )

  const addPerson = useCallback(
    async (personData: Omit<FavoritePerson, "addedAt">) => {
      await addPersonMutation.mutateAsync(personData)
    },
    [addPersonMutation],
  )

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
  const { allPersons, loading } = useFavoritePersons()
  const isFavorited = allPersons.some((p) => p.id === personId)
  return { isFavorited, loading }
}

/**
 * Hook for favorite person mutations with loading states.
 */
export function useFavoritePersonActions() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [isAdding, setIsAdding] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)

  const userId = user && !user.isAnonymous ? user.uid : null

  const addPerson = useCallback(
    async (personData: Omit<FavoritePerson, "addedAt">) => {
      if (!userId) {
        throw new Error("Please sign in to add favorites")
      }

      setIsAdding(true)
      try {
        await addFavoritePerson(userId, personData)
        await queryClient.invalidateQueries({
          queryKey: queryKeys.firestore.favoritePersons(userId),
        })
      } finally {
        setIsAdding(false)
      }
    },
    [queryClient, userId],
  )

  const removePerson = useCallback(
    async (personId: number) => {
      if (!userId) {
        throw new Error("Please sign in to remove favorites")
      }

      setIsRemoving(true)
      try {
        await removeFavoritePerson(userId, personId)
        await queryClient.invalidateQueries({
          queryKey: queryKeys.firestore.favoritePersons(userId),
        })
      } finally {
        setIsRemoving(false)
      }
    },
    [queryClient, userId],
  )

  return {
    addPerson,
    removePerson,
    isAdding,
    isRemoving,
    isAuthenticated: !!userId,
  }
}
