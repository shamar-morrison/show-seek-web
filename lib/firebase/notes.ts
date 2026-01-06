/**
 * Firebase Firestore operations for user notes
 * Path: users/{userId}/notes/{noteId}
 */

import type { Note, NoteInput } from "@/types/note"
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  Timestamp,
  type Unsubscribe,
} from "firebase/firestore"
import { db } from "./config"

/**
 * Generate document ID for a note
 * Format: {mediaType}-{mediaId}
 */
function getNoteDocId(mediaType: "movie" | "tv", mediaId: number): string {
  return `${mediaType}-${mediaId}`
}

/**
 * Get the Firestore reference for a user's notes collection
 */
function getNotesCollectionRef(userId: string) {
  return collection(db, "users", userId, "notes")
}

/**
 * Get the Firestore reference for a specific note
 */
function getNoteRef(
  userId: string,
  mediaType: "movie" | "tv",
  mediaId: number,
) {
  const docId = getNoteDocId(mediaType, mediaId)
  return doc(db, "users", userId, "notes", docId)
}

/**
 * Set or update a note for a media item
 * Idempotent - safe to call multiple times for the same item
 */
export async function setNote(userId: string, input: NoteInput): Promise<void> {
  const noteRef = getNoteRef(userId, input.mediaType, input.mediaId)
  const now = Timestamp.now()

  // Check if note already exists for createdAt handling
  const existingDoc = await getDoc(noteRef)
  const createdAt = existingDoc.exists() ? existingDoc.data().createdAt : now

  const note = {
    ...input,
    createdAt,
    updatedAt: now,
  }

  await setDoc(noteRef, note)
}

/**
 * Get a user's note for a specific media item
 * Returns null if no note exists
 */
export async function getNote(
  userId: string,
  mediaType: "movie" | "tv",
  mediaId: number,
): Promise<Note | null> {
  const noteRef = getNoteRef(userId, mediaType, mediaId)
  const snapshot = await getDoc(noteRef)

  if (!snapshot.exists()) {
    return null
  }

  return snapshot.data() as Note
}

/**
 * Delete a note for a media item
 */
export async function deleteNote(
  userId: string,
  mediaType: "movie" | "tv",
  mediaId: number,
): Promise<void> {
  const noteRef = getNoteRef(userId, mediaType, mediaId)
  await deleteDoc(noteRef)
}

/**
 * Subscribe to real-time updates for all user notes
 * Returns an unsubscribe function
 */
export function subscribeToNotes(
  userId: string,
  onNotesChange: (notes: Map<string, Note>) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const notesRef = getNotesCollectionRef(userId)

  return onSnapshot(
    notesRef,
    (snapshot) => {
      const notesMap = new Map<string, Note>()
      snapshot.docs.forEach((doc) => {
        const note = doc.data() as Note
        // Key by mediaType-mediaId for easy lookup
        notesMap.set(doc.id, note)
      })
      onNotesChange(notesMap)
    },
    (error) => {
      console.error("Error subscribing to notes:", error)
      onError?.(error)
    },
  )
}
