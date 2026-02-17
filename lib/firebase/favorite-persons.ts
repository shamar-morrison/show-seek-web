/**
 * Firebase Firestore operations for favorite persons
 * Path: users/{userId}/favorite_persons/{personId}
 */

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
} from "firebase/firestore"
import { db } from "./config"

/**
 * Favorite person data structure matching Firebase schema
 */
export interface FavoritePerson {
  /** Person ID (TMDB) */
  id: number
  /** Person name */
  name: string
  /** Department (e.g., "Acting", "Directing") */
  known_for_department: string
  /** Profile image path */
  profile_path: string | null
  /** Timestamp when added to favorites */
  addedAt: number
}

/**
 * Get the Firestore reference for a user's favorite_persons collection
 */
function getFavoritePersonsCollectionRef(userId: string) {
  return collection(db, "users", userId, "favorite_persons")
}

/**
 * Get the Firestore reference for a specific favorite person
 */
function getFavoritePersonRef(userId: string, personId: number) {
  return doc(db, "users", userId, "favorite_persons", String(personId))
}

/**
 * Convert Firestore document data to FavoritePerson interface
 */
function toFavoritePerson(data: Record<string, unknown>): FavoritePerson {
  return {
    id: data.id as number,
    name: data.name as string,
    known_for_department: (data.known_for_department as string) || "Unknown",
    profile_path: (data.profile_path as string) || null,
    addedAt: data.addedAt as number,
  }
}

/**
 * Fetch favorite persons with a one-time read.
 * Data is sorted by addedAt descending (most recent first).
 */
export async function fetchFavoritePersons(
  userId: string,
): Promise<FavoritePerson[]> {
  const personsRef = getFavoritePersonsCollectionRef(userId)
  const q = query(personsRef, orderBy("addedAt", "desc"))
  const snapshot = await getDocs(q)

  return snapshot.docs.map((docSnapshot) =>
    toFavoritePerson(docSnapshot.data()),
  )
}

/**
 * Remove a person from favorites
 */
export async function removeFavoritePerson(
  userId: string,
  personId: number,
): Promise<void> {
  const personRef = getFavoritePersonRef(userId, personId)
  await deleteDoc(personRef)
}

/**
 * Add a person to favorites
 * Uses Date.now() for timestamp to match mobile app implementation
 */
export async function addFavoritePerson(
  userId: string,
  personData: Omit<FavoritePerson, "addedAt">,
): Promise<void> {
  const personRef = getFavoritePersonRef(userId, personData.id)

  const favoriteData: FavoritePerson = {
    ...personData,
    addedAt: Date.now(),
  }

  await setDoc(personRef, favoriteData)
}
