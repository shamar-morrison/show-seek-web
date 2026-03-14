"use client"

/**
 * Firebase Firestore operations for user notes
 * Path: users/{userId}/notes/{noteId}
 */

import type { Note, NoteInput } from "@/types/note"
import { getNoteId } from "@/lib/note-utils"
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  Timestamp,
} from "firebase/firestore"
import { getFirebaseDb } from "./config"

/**
 * Generate document ID for a note
 * Format: {mediaType}-{mediaId} or episode-{mediaId}-{seasonNumber}-{episodeNumber}
 */
function getNoteDocId(
  mediaType: Note["mediaType"],
  mediaId: number,
  seasonNumber?: number,
  episodeNumber?: number,
): string {
  return getNoteId(mediaType, mediaId, seasonNumber, episodeNumber)
}

function toNote(docId: string, data: Record<string, unknown>): Note {
  return {
    id: docId,
    userId: data.userId as string,
    mediaId: data.mediaId as number,
    mediaType: data.mediaType as Note["mediaType"],
    content: data.content as string,
    mediaTitle: data.mediaTitle as string,
    originalTitle: data.originalTitle as string | undefined,
    posterPath: (data.posterPath as string | null | undefined) ?? null,
    seasonNumber: data.seasonNumber as number | undefined,
    episodeNumber: data.episodeNumber as number | undefined,
    showId: data.showId as number | undefined,
    createdAt: data.createdAt as Timestamp,
    updatedAt: data.updatedAt as Timestamp,
  }
}

/**
 * Get the Firestore reference for a user's notes collection
 */
function getNotesCollectionRef(userId: string) {
  return collection(getFirebaseDb(), "users", userId, "notes")
}

/**
 * Fetch all user notes with a one-time read.
 */
export async function fetchNotes(userId: string): Promise<Map<string, Note>> {
  const notesRef = getNotesCollectionRef(userId)
  const snapshot = await getDocs(notesRef)
  const notesMap = new Map<string, Note>()

  snapshot.docs.forEach((docSnapshot) => {
    const note = toNote(docSnapshot.id, docSnapshot.data())
    notesMap.set(docSnapshot.id, note)
  })

  return notesMap
}

/**
 * Get the Firestore reference for a specific note
 */
function getNoteRef(
  userId: string,
  mediaType: Note["mediaType"],
  mediaId: number,
  seasonNumber?: number,
  episodeNumber?: number,
) {
  const docId = getNoteDocId(mediaType, mediaId, seasonNumber, episodeNumber)
  return doc(getFirebaseDb(), "users", userId, "notes", docId)
}

/**
 * Set or update a note for a media item
 * Idempotent - safe to call multiple times for the same item
 */
export async function setNote(userId: string, input: NoteInput): Promise<void> {
  const expectedId = getNoteDocId(
    input.mediaType,
    input.mediaId,
    input.seasonNumber,
    input.episodeNumber,
  )

  if (input.id !== expectedId) {
    throw new Error(`Note id mismatch: expected ${expectedId}, received ${input.id}`)
  }

  const noteRef = getNoteRef(
    userId,
    input.mediaType,
    input.mediaId,
    input.seasonNumber,
    input.episodeNumber,
  )
  const now = Timestamp.now()

  // Check if note already exists for createdAt handling
  const existingDoc = await getDoc(noteRef)
  const createdAt = existingDoc.exists() ? existingDoc.data().createdAt : now

  const note: Record<string, unknown> = {
    userId: input.userId,
    mediaType: input.mediaType,
    mediaId: input.mediaId,
    content: input.content,
    mediaTitle: input.mediaTitle,
    posterPath: input.posterPath,
    createdAt,
    updatedAt: now,
  }

  if (input.originalTitle !== undefined) {
    note.originalTitle = input.originalTitle
  }

  if (input.seasonNumber !== undefined) {
    note.seasonNumber = input.seasonNumber
  }

  if (input.episodeNumber !== undefined) {
    note.episodeNumber = input.episodeNumber
  }

  if (input.showId !== undefined) {
    note.showId = input.showId
  }

  await setDoc(noteRef, note)
}

/**
 * Get a user's note for a specific media item
 * Returns null if no note exists
 */
export async function getNote(
  userId: string,
  mediaType: Note["mediaType"],
  mediaId: number,
  seasonNumber?: number,
  episodeNumber?: number,
): Promise<Note | null> {
  const noteRef = getNoteRef(
    userId,
    mediaType,
    mediaId,
    seasonNumber,
    episodeNumber,
  )
  const snapshot = await getDoc(noteRef)

  if (!snapshot.exists()) {
    return null
  }

  return toNote(snapshot.id, snapshot.data())
}

/**
 * Delete a note for a media item
 */
export async function deleteNote(
  userId: string,
  mediaType: Note["mediaType"],
  mediaId: number,
  seasonNumber?: number,
  episodeNumber?: number,
): Promise<void> {
  const noteRef = getNoteRef(
    userId,
    mediaType,
    mediaId,
    seasonNumber,
    episodeNumber,
  )
  await deleteDoc(noteRef)
}
