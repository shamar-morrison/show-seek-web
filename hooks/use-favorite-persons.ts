"use client"

import { useAuth } from "@/context/auth-context"
import {
  addFavoritePerson,
  FavoritePerson,
  removeFavoritePerson,
  subscribeToFavoritePersons,
} from "@/lib/firebase/favorite-persons"
import { useCallback, useEffect, useMemo, useState } from "react"

/**
 * Hook for managing favorite persons with real-time updates and search
 */
export function useFavoritePersons() {
  const { user } = useAuth()
  const [persons, setPersons] = useState<FavoritePerson[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  // Subscribe to favorite persons
  useEffect(() => {
    if (!user || user.isAnonymous) {
      setPersons([])
      setLoading(false)
      return
    }

    setLoading(true)
    const unsubscribe = subscribeToFavoritePersons(
      user.uid,
      (data) => {
        setPersons(data)
        setLoading(false)
        setError(null)
      },
      (err) => {
        setError(err)
        setLoading(false)
      },
    )

    return () => unsubscribe()
  }, [user])

  // Filter persons by search query
  const filteredPersons = useMemo(() => {
    if (!searchQuery.trim()) return persons

    const query = searchQuery.toLowerCase()
    return persons.filter((person) => person.name.toLowerCase().includes(query))
  }, [persons, searchQuery])

  // Remove a person from favorites
  const removePerson = useCallback(
    async (personId: number) => {
      if (!user || user.isAnonymous) return

      try {
        await removeFavoritePerson(user.uid, personId)
      } catch (err) {
        console.error("Failed to remove favorite person:", err)
        throw err
      }
    },
    [user],
  )

  // Add a person to favorites
  const addPerson = useCallback(
    async (personData: Omit<FavoritePerson, "addedAt">) => {
      if (!user || user.isAnonymous) return

      try {
        await addFavoritePerson(user.uid, personData)
      } catch (err) {
        console.error("Failed to add favorite person:", err)
        throw err
      }
    },
    [user],
  )

  // Check if a specific person is favorited
  const isPersonFavorited = useCallback(
    (personId: number) => persons.some((p) => p.id === personId),
    [persons],
  )

  return {
    /** Filtered list of favorite persons */
    persons: filteredPersons,
    /** All favorite persons (unfiltered, for checking favorites) */
    allPersons: persons,
    /** Total count (unfiltered) */
    count: persons.length,
    /** Loading state */
    loading,
    /** Error state */
    error,
    /** Current search query */
    searchQuery,
    /** Update search query */
    setSearchQuery,
    /** Remove a person from favorites */
    removePerson,
    /** Add a person to favorites */
    addPerson,
    /** Check if a person is favorited */
    isPersonFavorited,
  }
}

/**
 * Hook for checking if a specific person is favorited (with real-time updates)
 */
export function useIsPersonFavorited(personId: number) {
  const { allPersons, loading } = useFavoritePersons()
  const isFavorited = allPersons.some((p) => p.id === personId)
  return { isFavorited, loading }
}

/**
 * Hook for favorite person mutations with loading states
 */
export function useFavoritePersonActions() {
  const { user } = useAuth()
  const [isAdding, setIsAdding] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)

  const addPerson = useCallback(
    async (personData: Omit<FavoritePerson, "addedAt">) => {
      if (!user || user.isAnonymous) {
        throw new Error("Please sign in to add favorites")
      }

      setIsAdding(true)
      try {
        await addFavoritePerson(user.uid, personData)
      } finally {
        setIsAdding(false)
      }
    },
    [user],
  )

  const removePerson = useCallback(
    async (personId: number) => {
      if (!user || user.isAnonymous) {
        throw new Error("Please sign in to remove favorites")
      }

      setIsRemoving(true)
      try {
        await removeFavoritePerson(user.uid, personId)
      } finally {
        setIsRemoving(false)
      }
    },
    [user],
  )

  return {
    addPerson,
    removePerson,
    isAdding,
    isRemoving,
    isAuthenticated: !!user && !user.isAnonymous,
  }
}
