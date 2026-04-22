import "server-only"

import { cookies } from "next/headers"
import { SESSION_COOKIE_NAME, SESSION_EXPIRY_DAYS } from "./server-auth"

export async function setFirebaseSessionCookie(
  sessionCookie: string,
): Promise<void> {
  const cookieStore = await cookies()

  cookieStore.set(SESSION_COOKIE_NAME, sessionCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_EXPIRY_DAYS * 24 * 60 * 60,
    path: "/",
  })
}
