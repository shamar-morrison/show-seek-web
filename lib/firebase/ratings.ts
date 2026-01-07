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
 * Handles Timestamp -> number conversion for ratedAt
 * Compatible with mobile app's data structure
 */
function toRating(docId: string, data: Record<string, unknown>): Rating {
  const ratedAt = data.ratedAt

  return {
    id: docId,
    mediaId: data.id as string,
    mediaType: data.mediaType as Rating["mediaType"],
    rating: data.rating as number,
    title: data.title as string,
    posterPath: (data.posterPath as string) || null,
    releaseDate: (data.releaseDate as string) || null,
    ratedAt:
      ratedAt instanceof Timestamp ? ratedAt.toMillis() : (ratedAt as number),
    // Episode fields
    tvShowId: data.tvShowId as number | undefined,
    seasonNumber: data.seasonNumber as number | undefined,
    episodeNumber: data.episodeNumber as number | undefined,
    episodeName: data.episodeName as string | undefined,
    tvShowName: data.tvShowName as string | undefined,
  }
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
  mediaId: number | string,
) {
  const docId = getRatingDocId(
    mediaType,
    typeof mediaId === "number" ? mediaId : parseInt(mediaId),
  )
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
  if (userId !== input.userId) {
    throw new Error(
      `UserId mismatch: path userId ${userId} does not match input userId ${input.userId}`,
    )
  }

  // Episodes require different document ID format - not yet implemented
  if (input.mediaType === "episode") {
    throw new Error("Episode ratings are not yet implemented")
  }

  const ratingRef = getRatingRef(userId, input.mediaType, input.mediaId)

  await runTransaction(db, async (transaction) => {
    const existingDoc = await transaction.get(ratingRef)
    const exists = existingDoc.exists()

    // Use mobile app's field structure
    transaction.set(
      ratingRef,
      {
        id: input.mediaId,
        mediaType: input.mediaType,
        rating: input.rating,
        title: input.title,
        posterPath: input.posterPath,
        releaseDate: input.releaseDate,
        // Always set ratedAt to current timestamp (matches mobile behavior)
        ratedAt: serverTimestamp(),
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

  return toRating(snapshot.id, snapshot.data())
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
      snapshot.docs.forEach((docSnapshot) => {
        const rating = toRating(docSnapshot.id, docSnapshot.data())
        // Key by document ID for easy lookup
        ratingsMap.set(docSnapshot.id, rating)
      })
      onRatingsChange(ratingsMap)
    },
    (error) => {
      console.error("Error subscribing to ratings:", error)
      onError?.(error)
    },
  )
}
