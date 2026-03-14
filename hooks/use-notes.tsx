"use client"

import { useAuth } from "@/context/auth-context"
import { deleteNote, fetchNotes, setNote } from "@/lib/firebase/notes"
import { getNoteId } from "@/lib/note-utils"
import { queryCacheProfiles } from "@/lib/react-query/query-options"
import { queryKeys } from "@/lib/react-query/query-keys"
import type { Note } from "@/types/note"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Timestamp } from "firebase/firestore"
import { useCallback } from "react"

interface NoteKeyVariables {
  mediaType: Note["mediaType"]
  mediaId: number
  seasonNumber?: number
  episodeNumber?: number
}

interface SaveNoteVariables extends NoteKeyVariables {
  content: string
  mediaTitle: string
  originalTitle?: string
  posterPath: string | null
  showId?: number
}

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
    mutationFn: async (variables: SaveNoteVariables) => {
      if (!userId) {
        throw new Error("User must be authenticated to save notes")
      }

      const noteId = getNoteId(
        variables.mediaType,
        variables.mediaId,
        variables.seasonNumber,
        variables.episodeNumber,
      )

      await setNote(userId, {
        id: noteId,
        userId,
        mediaType: variables.mediaType,
        mediaId: variables.mediaId,
        content: variables.content,
        mediaTitle: variables.mediaTitle,
        originalTitle: variables.originalTitle,
        posterPath: variables.posterPath,
        seasonNumber: variables.seasonNumber,
        episodeNumber: variables.episodeNumber,
        showId: variables.showId,
      })
    },
    onMutate: async (variables) => {
      if (!notesQueryKey) {
        return { previousNotes: undefined as Map<string, Note> | undefined }
      }

      await queryClient.cancelQueries({ queryKey: notesQueryKey })
      const previousNotes = queryClient.getQueryData<Map<string, Note>>(notesQueryKey)

      const nextNotes = new Map(previousNotes ?? [])
      const key = getNoteId(
        variables.mediaType,
        variables.mediaId,
        variables.seasonNumber,
        variables.episodeNumber,
      )
      const existing = nextNotes.get(key)

      nextNotes.set(key, {
        id: key,
        userId: userId ?? "",
        mediaId: variables.mediaId,
        mediaType: variables.mediaType,
        content: variables.content,
        mediaTitle: variables.mediaTitle,
        originalTitle: variables.originalTitle,
        posterPath: variables.posterPath,
        seasonNumber: variables.seasonNumber,
        episodeNumber: variables.episodeNumber,
        showId: variables.showId,
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
    mutationFn: async (variables: NoteKeyVariables) => {
      if (!userId) {
        throw new Error("User must be authenticated to remove notes")
      }

      await deleteNote(
        userId,
        variables.mediaType,
        variables.mediaId,
        variables.seasonNumber,
        variables.episodeNumber,
      )
    },
    onMutate: async (variables) => {
      if (!notesQueryKey) {
        return { previousNotes: undefined as Map<string, Note> | undefined }
      }

      await queryClient.cancelQueries({ queryKey: notesQueryKey })
      const previousNotes = queryClient.getQueryData<Map<string, Note>>(notesQueryKey)

      const nextNotes = new Map(previousNotes ?? [])
      nextNotes.delete(
        getNoteId(
          variables.mediaType,
          variables.mediaId,
          variables.seasonNumber,
          variables.episodeNumber,
        ),
      )

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
    (
      mediaType: Note["mediaType"],
      mediaId: number,
      seasonNumber?: number,
      episodeNumber?: number,
    ): Note | null => {
      try {
        const key = getNoteId(mediaType, mediaId, seasonNumber, episodeNumber)
        return notes.get(key) || null
      } catch {
        return null
      }
    },
    [notes],
  )

  const { mutateAsync: saveNoteMutateAsync } = saveNoteMutation
  const { mutateAsync: removeNoteMutateAsync } = removeNoteMutation

  const saveNote = useCallback(
    async (
      mediaType: Note["mediaType"],
      mediaId: number,
      content: string,
      mediaTitle: string,
      originalTitle: string | undefined,
      posterPath: string | null,
      seasonNumber?: number,
      episodeNumber?: number,
      showId?: number,
    ): Promise<void> => {
      await saveNoteMutateAsync({
        mediaType,
        mediaId,
        content,
        mediaTitle,
        originalTitle,
        posterPath,
        seasonNumber,
        episodeNumber,
        showId,
      })
    },
    [saveNoteMutateAsync],
  )

  const removeNote = useCallback(
    async (
      mediaType: Note["mediaType"],
      mediaId: number,
      seasonNumber?: number,
      episodeNumber?: number,
    ): Promise<void> => {
      await removeNoteMutateAsync({
        mediaType,
        mediaId,
        seasonNumber,
        episodeNumber,
      })
    },
    [removeNoteMutateAsync],
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
