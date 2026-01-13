"use client"

import { useAuth } from "@/context/auth-context"
import { useFirestoreSubscription } from "@/hooks/use-firestore-subscription"
import { deleteNote, setNote, subscribeToNotes } from "@/lib/firebase/notes"
import type { Note } from "@/types/note"
import { useCallback } from "react"

/**
 * Hook for managing user notes with real-time updates
 */
export function useNotes() {
  const { user } = useAuth()

  const { data: notes, loading } = useFirestoreSubscription<Map<string, Note>>({
    subscribe: subscribeToNotes,
    initialValue: new Map(),
  })

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
