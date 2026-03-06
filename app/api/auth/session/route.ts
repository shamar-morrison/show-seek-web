import {
  createSessionCookie,
  SESSION_COOKIE_NAME,
  SESSION_EXPIRY_DAYS,
} from "@/lib/firebase/session"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

function isInvalidIdTokenError(message: string): boolean {
  const normalizedMessage = message.toLowerCase()

  return (
    normalizedMessage.includes("invalid_id_token") ||
    normalizedMessage.includes("invalid authentication token") ||
    (normalizedMessage.includes("id token") &&
      (normalizedMessage.includes("expired") ||
        normalizedMessage.includes("invalid") ||
        normalizedMessage.includes("malformed")))
  )
}

function getSessionCreationErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error"
  const invalidIdToken = isInvalidIdTokenError(message)

  return {
    error: invalidIdToken
      ? "Invalid authentication token"
      : "Authentication service temporarily unavailable",
    logMessage: message,
    status: invalidIdToken ? 401 : 503,
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { idToken?: string }
    const idToken = body.idToken

    if (!idToken) {
      return NextResponse.json({ error: "ID token required" }, { status: 400 })
    }

    const sessionCookie = await createSessionCookie(idToken)

    if (!sessionCookie) {
      return NextResponse.json(
        { error: "Authentication service temporarily unavailable" },
        { status: 503 },
      )
    }

    const cookieStore = await cookies()

    cookieStore.set(SESSION_COOKIE_NAME, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_EXPIRY_DAYS * 24 * 60 * 60, // 5 days in seconds
      path: "/",
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    const failure = getSessionCreationErrorResponse(error)

    console.error("Session creation failed:", {
      reason: failure.logMessage,
      status: failure.status,
    })

    return NextResponse.json(
      { error: failure.error },
      { status: failure.status },
    )
  }
}
