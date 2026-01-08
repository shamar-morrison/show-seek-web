/**
 * Firebase account deletion service
 * Handles complete cleanup of user data and auth account
 */

import { db } from "@/lib/firebase/config"
import { User } from "firebase/auth"
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  writeBatch,
} from "firebase/firestore"

/**
 * Subcollections that need to be deleted when removing a user account
 */
const USER_SUBCOLLECTIONS = [
  "ratings",
  "lists",
  "notes",
  "favorites",
  "watchlist",
  "favorite_persons",
  "episode_tracking",
  "reminders",
]

/**
 * Delete all documents in a subcollection using batched writes
 * Firestore batches support up to 500 operations
 */
async function deleteSubcollection(
  userId: string,
  subcollectionName: string,
): Promise<void> {
  const collectionRef = collection(db, "users", userId, subcollectionName)
  const snapshot = await getDocs(collectionRef)

  if (snapshot.empty) return

  // Process in batches of 500 (Firestore limit)
  const batchSize = 500
  const docs = snapshot.docs

  for (let i = 0; i < docs.length; i += batchSize) {
    const batch = writeBatch(db)
    const chunk = docs.slice(i, i + batchSize)

    chunk.forEach((docSnapshot) => {
      batch.delete(docSnapshot.ref)
    })

    await batch.commit()
  }
}

/**
 * Delete all user data from Firestore
 * Must be called before deleting the Auth account
 */
async function deleteAllUserData(userId: string): Promise<void> {
  // Delete all subcollections in parallel
  await Promise.all(
    USER_SUBCOLLECTIONS.map((subcollection) =>
      deleteSubcollection(userId, subcollection),
    ),
  )

  // Delete the user document itself
  const userDocRef = doc(db, "users", userId)
  await deleteDoc(userDocRef)
}

/**
 * Complete account deletion process
 * 1. Delete all Firestore data
 * 2. Delete the Auth account
 *
 * Note: User must be recently authenticated before calling this
 */
export async function deleteUserAccount(user: User): Promise<void> {
  const userId = user.uid

  // Step 1: Delete all Firestore data
  await deleteAllUserData(userId)

  // Step 2: Delete the Auth account
  // This requires recent authentication
  await user.delete()
}
