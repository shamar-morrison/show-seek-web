/**
 * Firebase Firestore operations for user ratings
 * Path: users/{userId}/ratings/{ratingId}
 */

import type { Rating, RatingInput } from "@/types/rating"
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  Timestamp,
  type Unsubscribe,
} from "firebase/firestore"
import { db } from "./config"

/**
 * Convert Firestore document data to Rating interface
 * Handles Timestamp -> number conversion for createdAt/updatedAt
 */
function toRating(data: Record<string, unknown>): Rating {
  const createdAt = data.createdAt
  const updatedAt = data.updatedAt

  return {
    ...data,
    createdAt:
      createdAt instanceof Timestamp
        ? createdAt.toMillis()
        : (createdAt as number),
    updatedAt:
      updatedAt instanceof Timestamp
        ? updatedAt.toMillis()
        : (updatedAt as number),
  } as Rating
}

/**
 * Generate document ID for a rating
 * Format: {mediaType}-{mediaId}
 */
function getRatingDocId(mediaType: "movie" | "tv", mediaId: number): string {
  return `${mediaType}-${mediaId}`
}

/**
 * Get the Firestore reference for a user's ratings collection
 */
function getRatingsCollectionRef(userId: string) {
  return collection(db, "users", userId, "ratings")
}

/**
 * Get the Firestore reference for a specific rating
 */
function getRatingRef(
  userId: string,
  mediaType: "movie" | "tv",
  mediaId: number,
) {
  const docId = getRatingDocId(mediaType, mediaId)
  return doc(db, "users", userId, "ratings", docId)
}

/**
 * Set or update a rating for a media item
 * Uses a transaction to preserve createdAt on updates
 * Only sets createdAt for new documents, always updates updatedAt
 */
export async function setRating(
  userId: string,
  input: RatingInput,
): Promise<void> {
  const ratingRef = getRatingRef(userId, input.mediaType, input.mediaId)

  await runTransaction(db, async (transaction) => {
    const existingDoc = await transaction.get(ratingRef)
    const exists = existingDoc.exists()

    transaction.set(
      ratingRef,
      {
        ...input,
        ...(exists ? {} : { createdAt: serverTimestamp() }),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    )
  })
}

/**
 * Get a user's rating for a specific media item
 * Returns null if no rating exists
 */
export async function getRating(
  userId: string,
  mediaType: "movie" | "tv",
  mediaId: number,
): Promise<Rating | null> {
  const ratingRef = getRatingRef(userId, mediaType, mediaId)
  const snapshot = await getDoc(ratingRef)

  if (!snapshot.exists()) {
    return null
  }

  return toRating(snapshot.data())
}

/**
 * Delete a rating for a media item
 */
export async function deleteRating(
  userId: string,
  mediaType: "movie" | "tv",
  mediaId: number,
): Promise<void> {
  const ratingRef = getRatingRef(userId, mediaType, mediaId)
  await deleteDoc(ratingRef)
}

/**
 * Subscribe to real-time updates for all user ratings
 * Returns an unsubscribe function
 */
export function subscribeToRatings(
  userId: string,
  onRatingsChange: (ratings: Map<string, Rating>) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const ratingsRef = getRatingsCollectionRef(userId)

  return onSnapshot(
    ratingsRef,
    (snapshot) => {
      const ratingsMap = new Map<string, Rating>()
      snapshot.docs.forEach((doc) => {
        const rating = toRating(doc.data())
        // Key by mediaType-mediaId for easy lookup
        ratingsMap.set(doc.id, rating)
      })
      onRatingsChange(ratingsMap)
    },
    (error) => {
      console.error("Error subscribing to ratings:", error)
      onError?.(error)
    },
  )
}
