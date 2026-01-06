import { User } from "firebase/auth"
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore"
import { db } from "./config"

export interface UserDocument {
  uid: string
  displayName: string | null
  email: string | null
  photoURL: string | null
  createdAt: ReturnType<typeof serverTimestamp>
}

/**
 * Create or update a user document in Firestore.
 * Idempotent - safe to call on every sign-in.
 */
export async function createUserDocument(user: User): Promise<void> {
  if (!user || user.isAnonymous) {
    return // Don't create documents for anonymous users
  }

  const userRef = doc(db, "users", user.uid)

  try {
    const existingDoc = await getDoc(userRef)

    if (existingDoc.exists()) {
      // Update only fields that might have changed
      const existingData = existingDoc.data() as UserDocument
      const updates: Partial<UserDocument> = {}

      if (user.photoURL && user.photoURL !== existingData.photoURL) {
        updates.photoURL = user.photoURL
      }

      if (user.displayName && user.displayName !== existingData.displayName) {
        updates.displayName = user.displayName
      }

      if (Object.keys(updates).length > 0) {
        await setDoc(userRef, updates, { merge: true })
      }
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
    }
  } catch (error) {
    console.warn("Failed to create/update user document:", error)
  }
}
