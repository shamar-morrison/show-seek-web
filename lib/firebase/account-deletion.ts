import { getFirebaseFunctions } from "./config"
import { httpsCallable } from "firebase/functions"

export interface DeleteAccountResult {
  success: true
}

/**
 * Delete Account Service (web)
 *
 * Invokes the shared `deleteAccount` callable Cloud Function (deployed from
 * the mobile repo's `functions/` into the same Firebase project). The
 * function deletes the user's Firestore tree (`users/{uid}`), their Trakt
 * OAuth states and RevenueCat webhook events, and finally the Firebase Auth
 * user. NOTE: this creates a cross-repo runtime dependency — if the function
 * is renamed or removed in the mobile repo, web account deletion breaks.
 *
 * NOTE FOR FUTURE CHANGES: if a new per-user data store is added anywhere
 * (new Firestore collections, new localStorage keys, new third-party
 * connections), make sure deletion covers it and update Privacy Policy
 * section 5.2 (`app/privacy/page.tsx`) to match.
 */
export async function deleteAccount(): Promise<DeleteAccountResult> {
  const deleteAccountCallable = httpsCallable<void, DeleteAccountResult>(
    getFirebaseFunctions(),
    "deleteAccount",
  )
  const result = await deleteAccountCallable()
  return result.data
}

/** Prefix for per-user Trakt state persisted in localStorage (web). */
const TRAKT_STATE_STORAGE_PREFIX = "showseek_trakt_state_v1"

/**
 * Clear user-scoped browser data after remote account deletion.
 * Mirrors the mobile `clearLocalAccountData` utility for web storage.
 */
export function clearLocalAccountData(userId: string): void {
  if (typeof window === "undefined") return

  try {
    window.localStorage.removeItem(`${TRAKT_STATE_STORAGE_PREFIX}_${userId}`)
  } catch (error) {
    console.warn("[accountDeletion] Failed to clear local account data:", error)
  }
}
