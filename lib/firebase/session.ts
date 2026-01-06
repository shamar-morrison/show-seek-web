import { cookies } from "next/headers"
import { adminAuth } from "./admin"

const SESSION_COOKIE_NAME = "session"
const SESSION_EXPIRY_DAYS = 5

/**
 * Create a session cookie from a Firebase ID token
 */
export async function createSessionCookie(
  idToken: string,
): Promise<string | null> {
  if (!adminAuth) {
    console.warn("Firebase Admin SDK not initialized in createSessionCookie")
    return null
  }

  const expiresIn = SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000 // 5 days in ms

  const sessionCookie = await adminAuth.createSessionCookie(idToken, {
    expiresIn,
  })
  return sessionCookie
}

/**
 * Verify a session cookie and return the decoded claims
 */
export async function verifySessionCookie() {
  if (!adminAuth) {
    return null
  }

  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value

  if (!sessionCookie) {
    return null
  }

  try {
    const decodedClaims = await adminAuth.verifySessionCookie(
      sessionCookie,
      true,
    )
    return decodedClaims
  } catch (error) {
    console.error("Session verification failed:", error)
    return null
  }
}

/**
 * Get the current authenticated user from the session
 */
export async function getCurrentUser() {
  if (!adminAuth) {
    return null
  }

  const claims = await verifySessionCookie()

  if (!claims) {
    return null
  }

  try {
    const user = await adminAuth.getUser(claims.uid)
    return user
  } catch (error) {
    console.error("Failed to get user:", error)
    return null
  }
}

export { SESSION_COOKIE_NAME, SESSION_EXPIRY_DAYS }
