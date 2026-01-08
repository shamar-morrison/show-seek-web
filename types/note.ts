/**
 * Note type definitions for user media notes
 */

import type { Timestamp } from "firebase/firestore"

export interface Note {
  /** User's Firebase UID */
  userId: string
  /** TMDB media ID */
  mediaId: number
  /** Type of media */
  mediaType: "movie" | "tv"
  /** Note content (max 120 characters per Firestore rules) */
  content: string
  /** Title of the media for display purposes */
  mediaTitle: string
  /** Poster path for display purposes (optional) */
  posterPath: string | null
  /** Timestamp when note was created */
  createdAt: Timestamp
  /** Timestamp when note was last updated */
  updatedAt: Timestamp
}

/**
 * Input type for creating/updating a note (without timestamps)
 */
export type NoteInput = Omit<Note, "createdAt" | "updatedAt">

/**
 * Maximum character limit for note content (enforced by Firestore rules)
 */
export const NOTE_MAX_LENGTH = 120
