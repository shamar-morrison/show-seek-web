"use client"

import { useAuth } from "@/context/auth-context"
import {
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

  return {
    /** Filtered list of favorite persons */
    persons: filteredPersons,
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
  }
}
