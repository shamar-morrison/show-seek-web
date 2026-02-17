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
  getDocs,
  setDoc,
  Timestamp,
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
 * Fetch all user notes with a one-time read.
 */
export async function fetchNotes(userId: string): Promise<Map<string, Note>> {
  const notesRef = getNotesCollectionRef(userId)
  const snapshot = await getDocs(notesRef)
  const notesMap = new Map<string, Note>()

  snapshot.docs.forEach((docSnapshot) => {
    const note = docSnapshot.data() as Note
    notesMap.set(docSnapshot.id, note)
  })

  return notesMap
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
