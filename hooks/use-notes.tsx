"use client"

import { useAuth } from "@/context/auth-context"
import { deleteNote, setNote, subscribeToNotes } from "@/lib/firebase/notes"
import type { Note } from "@/types/note"
import { useCallback, useEffect, useState } from "react"

/**
 * Hook for managing user notes with real-time updates
 */
export function useNotes() {
  const { user, loading: authLoading } = useAuth()
  const [notes, setNotes] = useState<Map<string, Note>>(new Map())
  const [loading, setLoading] = useState(true)

  // Subscribe to real-time note updates
  useEffect(() => {
    if (authLoading) return
    if (!user || user.isAnonymous) {
      setNotes(new Map())
      setLoading(false)
      return
    }

    setLoading(true)
    const unsubscribe = subscribeToNotes(
      user.uid,
      (notesMap) => {
        setNotes(notesMap)
        setLoading(false)
      },
      (error) => {
        console.error("Error loading notes:", error)
        setLoading(false)
      },
    )

    return () => unsubscribe()
  }, [user, authLoading])

  /**
   * Get a note for a specific media item
   */
  const getNote = useCallback(
    (mediaType: "movie" | "tv", mediaId: number): Note | null => {
      const key = `${mediaType}-${mediaId}`
      return notes.get(key) || null
    },
    [notes],
  )

  /**
   * Save or update a note for a media item
   */
  const saveNote = useCallback(
    async (
      mediaType: "movie" | "tv",
      mediaId: number,
      content: string,
      mediaTitle: string,
      posterPath: string | null,
    ): Promise<void> => {
      if (!user || user.isAnonymous) {
        throw new Error("User must be authenticated to save notes")
      }

      await setNote(user.uid, {
        userId: user.uid,
        mediaType,
        mediaId,
        content,
        mediaTitle,
        posterPath,
      })
    },
    [user],
  )

  /**
   * Remove a note for a media item
   */
  const removeNote = useCallback(
    async (mediaType: "movie" | "tv", mediaId: number): Promise<void> => {
      if (!user || user.isAnonymous) {
        throw new Error("User must be authenticated to remove notes")
      }

      await deleteNote(user.uid, mediaType, mediaId)
    },
    [user],
  )

  return {
    notes,
    loading,
    getNote,
    saveNote,
    removeNote,
  }
}
