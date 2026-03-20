"use client"

import { User } from "firebase/auth"
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore"
import type { StoredUserPreferences } from "@/lib/user-preferences"
import { getFirebaseDb } from "./config"

export {
  DEFAULT_PREFERENCES,
  hydrateUserPreferences,
} from "@/lib/user-preferences"
export type {
  HomeListType,
  HomeScreenListItem,
  UserPreferences,
} from "@/lib/user-preferences"

export interface UserDocument {
  uid: string
  displayName: string | null
  email: string | null
  photoURL: string | null
  region?: string
  createdAt: ReturnType<typeof serverTimestamp>
  premium?: {
    isPremium: boolean
    orderId?: string
    productId?: string
    purchaseDate?: ReturnType<typeof serverTimestamp>
  }
  preferences?: StoredUserPreferences
}

/**
 * Create or update a user document in Firestore.
 * Idempotent - safe to call on every sign-in.
 */
export async function createUserDocument(user: User): Promise<boolean> {
  if (!user || user.isAnonymous) {
    return false // Don't create documents for anonymous users
  }

  const userRef = doc(getFirebaseDb(), "users", user.uid)

  try {
    const existingDoc = await getDoc(userRef)

    if (existingDoc.exists()) {
      // Update only fields that might have changed
      const rawData = existingDoc.data()

      // Runtime guard: validate data shape before accessing fields
      const existingData =
        rawData &&
        (typeof rawData.photoURL === "string" ||
          rawData.photoURL === null ||
          rawData.photoURL === undefined) &&
        (typeof rawData.displayName === "string" ||
          rawData.displayName === null ||
          rawData.displayName === undefined) &&
        (typeof rawData.email === "string" ||
          rawData.email === null ||
          rawData.email === undefined)
          ? (rawData as UserDocument)
          : null

      if (!existingData) {
        console.warn("Invalid user document shape in Firestore")
        return false
      }

      const updates: Partial<UserDocument> = {}

      if (user.photoURL !== existingData.photoURL) {
        updates.photoURL = user.photoURL
      }

      if (user.displayName !== existingData.displayName) {
        updates.displayName = user.displayName
      }

      if (user.email !== existingData.email) {
        updates.email = user.email
      }

      if (Object.keys(updates).length > 0) {
        await setDoc(userRef, updates, { merge: true })
      }

      return true
    } else {
      // Create new document
      const userData: UserDocument = {
        uid: user.uid,
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        createdAt: serverTimestamp(),
      }
      await setDoc(userRef, userData)

      return true
    }
  } catch (error) {
    console.warn("Failed to create/update user document:", error)
    return false
  }
}
