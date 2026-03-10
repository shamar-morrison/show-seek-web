import { cookies } from "next/headers"
import {
  createSessionCookie,
  type FirebaseAccountInfo,
  isSessionVerificationUnavailable,
  isSessionVerificationValid,
  SESSION_COOKIE_NAME,
  SESSION_EXPIRY_DAYS,
  type SessionVerificationMode,
  type SessionVerificationResult,
  verifySessionCookieValue,
} from "./server-auth"

export { createSessionCookie, SESSION_COOKIE_NAME, SESSION_EXPIRY_DAYS }

/**
 * Verify the current request's session cookie and return the decoded claims.
 */
export async function verifySessionCookie(
  mode: SessionVerificationMode = "strict",
): Promise<SessionVerificationResult> {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value

  if (!sessionCookie) {
    return {
      account: null,
      status: "invalid" as const,
      claims: null,
      reason: "Missing session cookie",
    }
  }

  return verifySessionCookieValue(sessionCookie, mode)
}

/**
 * Read the current authenticated user account from the verified session cookie.
 */
export async function getCurrentUser(): Promise<
  FirebaseAccountInfo | null | "unavailable"
> {
  const verification = await verifySessionCookie("strict")

  if (isSessionVerificationUnavailable(verification)) {
    return "unavailable"
  }

  if (!isSessionVerificationValid(verification)) {
    return null
  }

  return verification.account
}
