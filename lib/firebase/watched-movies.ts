/**
 * Firebase Firestore operations for movie watch history
 * Path: users/{userId}/watched_movies/{movieId}/watches/{watchId}
 */

import { db } from "@/lib/firebase/config"
import {
  collection,
  doc,
  getDocs,
  setDoc,
  Timestamp,
  writeBatch,
} from "firebase/firestore"

/** A single watch instance */
export interface WatchInstance {
  id: string
  movieId: number
  watchedAt: Date
}

/** Raw Firestore document shape */
interface WatchInstanceDoc {
  movieId: number
  watchedAt: Timestamp
}

/**
 * Fetch watch history for a specific movie.
 */
export async function fetchWatches(
  userId: string,
  movieId: number,
): Promise<WatchInstance[]> {
  const watchesRef = collection(
    db,
    "users",
    userId,
    "watched_movies",
    String(movieId),
    "watches",
  )

  const snapshot = await getDocs(watchesRef)

  const instances: WatchInstance[] = snapshot.docs.map((watchDoc) => {
    const data = watchDoc.data() as WatchInstanceDoc
    return {
      id: watchDoc.id,
      movieId: data.movieId,
      watchedAt: data.watchedAt?.toDate() ?? new Date(),
    }
  })

  instances.sort((a, b) => b.watchedAt.getTime() - a.watchedAt.getTime())
  return instances
}

/**
 * Add a watch instance for a movie
 * Returns the generated watch ID
 */
export async function addWatch(
  userId: string,
  movieId: number,
  watchedAt: Date,
): Promise<string> {
  const watchesRef = collection(
    db,
    "users",
    userId,
    "watched_movies",
    String(movieId),
    "watches",
  )

  // Generate a unique ID
  const watchId = doc(watchesRef).id

  // Payload must ONLY contain watchedAt and movieId per Firestore rules
  await setDoc(doc(watchesRef, watchId), {
    movieId,
    watchedAt: Timestamp.fromDate(watchedAt),
  })

  return watchId
}

/**
 * Clear all watch history for a movie
 * Uses batch delete for atomicity
 */
export async function clearWatches(
  userId: string,
  movieId: number,
): Promise<void> {
  const watchesRef = collection(
    db,
    "users",
    userId,
    "watched_movies",
    String(movieId),
    "watches",
  )

  const snapshot = await getDocs(watchesRef)

  if (snapshot.empty) return

  const BATCH_LIMIT = 500
  for (let i = 0; i < snapshot.docs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db)
    const chunk = snapshot.docs.slice(i, i + BATCH_LIMIT)
    chunk.forEach((watchDoc) => {
      batch.delete(watchDoc.ref)
    })
    await batch.commit()
  }
  // Note: Do NOT delete parent watched_movies/{movieId} doc - no write permission
}

/**
 * Get the count of watch instances for a movie
 * Useful for checking if this is the first watch
 */
export async function getWatchCount(
  userId: string,
  movieId: number,
): Promise<number> {
  const watchesRef = collection(
    db,
    "users",
    userId,
    "watched_movies",
    String(movieId),
    "watches",
  )

  const snapshot = await getDocs(watchesRef)
  return snapshot.size
}
