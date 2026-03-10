import type { TrackedCollection } from "@/types/collection-tracking"
import { db } from "@/lib/firebase/config"
import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  setDoc,
  updateDoc,
} from "firebase/firestore"

export const MAX_FREE_COLLECTIONS = 2

const WATCHED_HISTORY_CHECK_BATCH_SIZE = 8
const WATCHED_HISTORY_CHECK_CONCURRENCY = 3

function getCollectionTrackingDocRef(userId: string, collectionId: number) {
  return doc(db, "users", userId, "collection_tracking", String(collectionId))
}

function getCollectionTrackingCollectionRef(userId: string) {
  return collection(db, "users", userId, "collection_tracking")
}

function normalizeTrackedCollection(
  rawData: Partial<TrackedCollection> | undefined,
): TrackedCollection | null {
  if (!rawData) return null

  if (
    typeof rawData.collectionId !== "number" ||
    typeof rawData.name !== "string" ||
    typeof rawData.totalMovies !== "number" ||
    typeof rawData.startedAt !== "number" ||
    typeof rawData.lastUpdated !== "number"
  ) {
    return null
  }

  return {
    collectionId: rawData.collectionId,
    name: rawData.name,
    totalMovies: rawData.totalMovies,
    watchedMovieIds: (rawData.watchedMovieIds ?? []).filter(
      (movieId): movieId is number => typeof movieId === "number",
    ),
    startedAt: rawData.startedAt,
    lastUpdated: rawData.lastUpdated,
  }
}

function getErrorCode(error: unknown): string | null {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  ) {
    return (error as { code: string }).code
  }

  return null
}

function getErrorMessage(error: unknown): string | null {
  if (error instanceof Error) {
    return error.message
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message
  }

  return null
}

function isNotFoundError(error: unknown): boolean {
  const code = getErrorCode(error)

  if (code !== null) {
    return code === "not-found" || code === "firestore/not-found"
  }

  const message = getErrorMessage(error)
  if (message?.includes("No document to update")) {
    return true
  }

  if (process.env.NODE_ENV !== "production") {
    console.debug(
      "[collection-tracking] Unexpected Firestore update error",
      error,
    )
  }

  return false
}

function chunkItems<T>(items: T[], chunkSize: number): T[][] {
  const chunks: T[][] = []

  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize))
  }

  return chunks
}

async function mapWithConcurrencyLimit<T, TResult>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<TResult>,
): Promise<TResult[]> {
  if (items.length === 0) {
    return []
  }

  let nextIndex = 0
  const results = new Array<TResult>(items.length)
  const runnerCount = Math.min(concurrency, items.length)

  async function runNext(): Promise<void> {
    if (nextIndex >= items.length) {
      return
    }

    const currentIndex = nextIndex
    nextIndex += 1
    results[currentIndex] = await worker(items[currentIndex] as T)
    await runNext()
  }

  await Promise.all(Array.from({ length: runnerCount }, () => runNext()))

  return results
}

export async function fetchCollectionTracking(
  userId: string,
  collectionId: number,
): Promise<TrackedCollection | null> {
  const snapshot = await getDoc(
    getCollectionTrackingDocRef(userId, collectionId),
  )

  if (!snapshot.exists()) {
    return null
  }

  return normalizeTrackedCollection(
    snapshot.data() as Partial<TrackedCollection>,
  )
}

export async function fetchAllTrackedCollections(
  userId: string,
): Promise<TrackedCollection[]> {
  const snapshot = await getDocs(getCollectionTrackingCollectionRef(userId))

  return snapshot.docs
    .map((trackedCollectionDoc) =>
      normalizeTrackedCollection(
        trackedCollectionDoc.data() as Partial<TrackedCollection>,
      ),
    )
    .filter(
      (trackedCollection): trackedCollection is TrackedCollection =>
        trackedCollection !== null,
    )
}

export async function getTrackedCollectionCount(
  userId: string,
): Promise<number> {
  const trackedCollections = await fetchAllTrackedCollections(userId)
  return trackedCollections.length
}

export async function getPreviouslyWatchedMovieIds(
  userId: string,
  movieIds: number[],
): Promise<number[]> {
  const uniqueMovieIds: number[] = []
  const seenMovieIds = new Set<number>()

  movieIds.forEach((movieId) => {
    if (
      !Number.isInteger(movieId) ||
      movieId <= 0 ||
      seenMovieIds.has(movieId)
    ) {
      return
    }

    seenMovieIds.add(movieId)
    uniqueMovieIds.push(movieId)
  })

  if (uniqueMovieIds.length === 0) {
    return []
  }

  const batches = chunkItems(uniqueMovieIds, WATCHED_HISTORY_CHECK_BATCH_SIZE)
  const watchedMovieIdsByBatch = await mapWithConcurrencyLimit(
    batches,
    WATCHED_HISTORY_CHECK_CONCURRENCY,
    async (batch) => {
      const batchResults = await Promise.all(
        batch.map(async (movieId) => {
          const watchesRef = collection(
            db,
            "users",
            userId,
            "watched_movies",
            String(movieId),
            "watches",
          )
          const snapshot = await getDocs(query(watchesRef, limit(1)))

          return snapshot.empty ? null : movieId
        }),
      )

      return batchResults.filter(
        (movieId): movieId is number => movieId !== null,
      )
    },
  )

  return watchedMovieIdsByBatch.flat()
}

export async function startCollectionTracking(
  userId: string,
  collectionId: number,
  name: string,
  totalMovies: number,
  initialWatchedMovieIds: number[] = [],
): Promise<void> {
  const now = Date.now()
  const trackedCollection: TrackedCollection = {
    collectionId,
    name,
    totalMovies,
    watchedMovieIds: initialWatchedMovieIds,
    startedAt: now,
    lastUpdated: now,
  }

  await setDoc(
    getCollectionTrackingDocRef(userId, collectionId),
    trackedCollection,
  )
}

export async function stopCollectionTracking(
  userId: string,
  collectionId: number,
): Promise<number[]> {
  const trackedCollectionRef = getCollectionTrackingDocRef(userId, collectionId)
  const snapshot = await getDoc(trackedCollectionRef)
  const trackedCollection = snapshot.exists()
    ? normalizeTrackedCollection(snapshot.data() as Partial<TrackedCollection>)
    : null

  await deleteDoc(trackedCollectionRef)
  return trackedCollection?.watchedMovieIds ?? []
}

export async function addWatchedMovieToTrackedCollection(
  userId: string,
  collectionId: number,
  movieId: number,
): Promise<void> {
  try {
    await updateDoc(getCollectionTrackingDocRef(userId, collectionId), {
      watchedMovieIds: arrayUnion(movieId),
      lastUpdated: Date.now(),
    })
  } catch (error) {
    if (isNotFoundError(error)) {
      return
    }

    throw error
  }
}

export async function removeWatchedMovieFromTrackedCollection(
  userId: string,
  collectionId: number,
  movieId: number,
): Promise<void> {
  try {
    await updateDoc(getCollectionTrackingDocRef(userId, collectionId), {
      watchedMovieIds: arrayRemove(movieId),
      lastUpdated: Date.now(),
    })
  } catch (error) {
    if (isNotFoundError(error)) {
      return
    }

    throw error
  }
}
