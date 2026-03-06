import { cookies } from "next/headers"
import {
  createSessionCookie,
  isSessionVerificationValid,
  type SessionVerificationMode,
  lookupFirebaseAccount,
  SESSION_COOKIE_NAME,
  SESSION_EXPIRY_DAYS,
  verifySessionCookieValue,
} from "./server-auth"

export { createSessionCookie, SESSION_COOKIE_NAME, SESSION_EXPIRY_DAYS }

/**
 * Verify the current request's session cookie and return the decoded claims.
 */
export async function verifySessionCookie(
  mode: SessionVerificationMode = "strict",
) {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value

  if (!sessionCookie) {
    return {
      status: "invalid" as const,
      claims: null,
      reason: "Missing session cookie",
    }
  }

  return verifySessionCookieValue(sessionCookie, mode)
}

/**
 * Look up the current authenticated user account from the session cookie.
 */
export async function getCurrentUser() {
  const verification = await verifySessionCookie("strict")

  if (!isSessionVerificationValid(verification)) {
    return null
  }

  return lookupFirebaseAccount(verification.claims.sub)
}
