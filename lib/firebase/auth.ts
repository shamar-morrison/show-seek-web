import { GoogleAuthProvider, signInWithPopup, User } from "firebase/auth"
import { auth } from "./config"

const googleProvider = new GoogleAuthProvider()

export type GoogleSignInResult =
  | { success: true; user: User }
  | { success: false; cancelled?: boolean; error?: string }

/**
 * Sign in with Google using popup (preferred for desktop)
 */
export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  try {
    const result = await signInWithPopup(auth, googleProvider)
    return { success: true, user: result.user }
  } catch (error: unknown) {
    console.error("[GoogleAuth] Error:", error)

    const firebaseError = error as { code?: string; message?: string }

    // User closed the popup
    if (firebaseError.code === "auth/popup-closed-by-user") {
      return { success: false, cancelled: true }
    }

    return { success: false, error: getGoogleAuthErrorMessage(firebaseError) }
  }
}

/**
 * Get user-friendly error message for Google auth errors
 */
export function getGoogleAuthErrorMessage(error: {
  code?: string
  message?: string
}): string {
  const code = error?.code

  switch (code) {
    case "auth/account-exists-with-different-credential":
      return "An account already exists with this email. Please sign in with email/password first."
    case "auth/credential-already-in-use":
      return "This Google account is already linked to another account."
    case "auth/email-already-in-use":
      return "An account with this email already exists. Try signing in with email/password."
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "" // User cancelled
    case "auth/network-request-failed":
      return "Network error. Please check your internet connection."
    case "auth/too-many-requests":
      return "Too many attempts. Please try again later."
    case "auth/operation-not-allowed":
      return "Google sign-in is not enabled. Please contact support."
    default:
      return (
        error?.message || "Unable to sign in with Google. Please try again."
      )
  }
}

/**
 * Get user-friendly error message for email/password auth errors
 */
export function getEmailAuthErrorMessage(error: {
  code?: string
  message?: string
}): string {
  switch (error?.code) {
    case "auth/invalid-credential":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "Invalid email or password. Please check your credentials."
    case "auth/invalid-email":
      return "Please enter a valid email address."
    case "auth/user-disabled":
      return "This account has been disabled. Please contact support."
    case "auth/too-many-requests":
      return "Too many failed attempts. Please try again later."
    case "auth/network-request-failed":
      return "Network error. Please check your internet connection."
    default:
      return error?.message || "Unable to sign in. Please try again."
  }
}
