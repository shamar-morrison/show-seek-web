import { cookies } from "next/headers"
import {
  createSessionCookie,
  lookupFirebaseAccount,
  SESSION_COOKIE_NAME,
  SESSION_EXPIRY_DAYS,
  verifySessionCookieValue,
} from "./server-auth"

export { createSessionCookie, SESSION_COOKIE_NAME, SESSION_EXPIRY_DAYS }

/**
 * Verify the current request's session cookie and return the decoded claims.
 */
export async function verifySessionCookie() {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value

  if (!sessionCookie) {
    return null
  }

  return verifySessionCookieValue(sessionCookie, true)
}

/**
 * Look up the current authenticated user account from the session cookie.
 */
export async function getCurrentUser() {
  const claims = await verifySessionCookie()

  if (!claims) {
    return null
  }

  return lookupFirebaseAccount(claims.sub)
}
