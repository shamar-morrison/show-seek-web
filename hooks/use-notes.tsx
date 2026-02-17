"use client"

import { useAuth } from "@/context/auth-context"
import { deleteNote, fetchNotes, setNote } from "@/lib/firebase/notes"
import { queryCacheProfiles } from "@/lib/react-query/query-options"
import { queryKeys } from "@/lib/react-query/query-keys"
import type { Note } from "@/types/note"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Timestamp } from "firebase/firestore"
import { useCallback } from "react"

/**
 * Hook for managing user notes with React Query caching.
 */
export function useNotes() {
  const { user, loading: authLoading } = useAuth()
  const queryClient = useQueryClient()

  const userId = user && !user.isAnonymous ? user.uid : null
  const notesQueryKey = userId ? queryKeys.firestore.notes(userId) : null

  const { data: notes = new Map<string, Note>(), isLoading } = useQuery({
    ...queryCacheProfiles.profile,
    queryKey: notesQueryKey ?? ["firestore", "notes", "guest"],
    queryFn: async () => {
      if (!userId) return new Map<string, Note>()
      return fetchNotes(userId)
    },
    enabled: !!userId,
  })

  const saveNoteMutation = useMutation({
    mutationFn: async (variables: {
      mediaType: "movie" | "tv"
      mediaId: number
      content: string
      mediaTitle: string
      posterPath: string | null
    }) => {
      if (!userId) {
        throw new Error("User must be authenticated to save notes")
      }

      await setNote(userId, {
        userId,
        mediaType: variables.mediaType,
        mediaId: variables.mediaId,
        content: variables.content,
        mediaTitle: variables.mediaTitle,
        posterPath: variables.posterPath,
      })
    },
    onMutate: async (variables) => {
      if (!notesQueryKey) {
        return { previousNotes: undefined as Map<string, Note> | undefined }
      }

      await queryClient.cancelQueries({ queryKey: notesQueryKey })
      const previousNotes = queryClient.getQueryData<Map<string, Note>>(notesQueryKey)

      const nextNotes = new Map(previousNotes ?? [])
      const key = `${variables.mediaType}-${variables.mediaId}`
      const existing = nextNotes.get(key)

      nextNotes.set(key, {
        userId: userId ?? "",
        mediaId: variables.mediaId,
        mediaType: variables.mediaType,
        content: variables.content,
        mediaTitle: variables.mediaTitle,
        posterPath: variables.posterPath,
        createdAt: existing?.createdAt ?? Timestamp.now(),
        updatedAt: Timestamp.now(),
      })

      queryClient.setQueryData(notesQueryKey, nextNotes)
      return { previousNotes }
    },
    onError: (_error, _variables, context) => {
      if (!notesQueryKey) return
      if (context?.previousNotes) {
        queryClient.setQueryData(notesQueryKey, context.previousNotes)
      }
    },
    onSettled: () => {
      if (!notesQueryKey) return
      queryClient.invalidateQueries({ queryKey: notesQueryKey })
    },
  })

  const removeNoteMutation = useMutation({
    mutationFn: async (variables: { mediaType: "movie" | "tv"; mediaId: number }) => {
      if (!userId) {
        throw new Error("User must be authenticated to remove notes")
      }

      await deleteNote(userId, variables.mediaType, variables.mediaId)
    },
    onMutate: async (variables) => {
      if (!notesQueryKey) {
        return { previousNotes: undefined as Map<string, Note> | undefined }
      }

      await queryClient.cancelQueries({ queryKey: notesQueryKey })
      const previousNotes = queryClient.getQueryData<Map<string, Note>>(notesQueryKey)

      const nextNotes = new Map(previousNotes ?? [])
      nextNotes.delete(`${variables.mediaType}-${variables.mediaId}`)

      queryClient.setQueryData(notesQueryKey, nextNotes)
      return { previousNotes }
    },
    onError: (_error, _variables, context) => {
      if (!notesQueryKey) return
      if (context?.previousNotes) {
        queryClient.setQueryData(notesQueryKey, context.previousNotes)
      }
    },
    onSettled: () => {
      if (!notesQueryKey) return
      queryClient.invalidateQueries({ queryKey: notesQueryKey })
    },
  })

  const getNote = useCallback(
    (mediaType: "movie" | "tv", mediaId: number): Note | null => {
      const key = `${mediaType}-${mediaId}`
      return notes.get(key) || null
    },
    [notes],
  )

  const saveNote = useCallback(
    async (
      mediaType: "movie" | "tv",
      mediaId: number,
      content: string,
      mediaTitle: string,
      posterPath: string | null,
    ): Promise<void> => {
      await saveNoteMutation.mutateAsync({
        mediaType,
        mediaId,
        content,
        mediaTitle,
        posterPath,
      })
    },
    [saveNoteMutation],
  )

  const removeNote = useCallback(
    async (mediaType: "movie" | "tv", mediaId: number): Promise<void> => {
      await removeNoteMutation.mutateAsync({ mediaType, mediaId })
    },
    [removeNoteMutation],
  )

  const loading = authLoading || (!!userId && isLoading)

  return {
    notes,
    loading,
    getNote,
    saveNote,
    removeNote,
  }
}
