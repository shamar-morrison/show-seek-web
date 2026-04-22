import {
  authenticateWithEmailAndPassword,
  FirebasePasswordAuthError,
  type FirebasePasswordAuthOperation,
} from "@/lib/firebase/password-auth"
import { createSessionCookie } from "@/lib/firebase/server-auth"
import { setFirebaseSessionCookie } from "@/lib/firebase/server-session-cookie"
import {
  getTurnstileRemoteIp,
  TURNSTILE_SECURITY_ERROR,
  verifyTurnstileToken,
} from "@/lib/turnstile"
import { NextRequest, NextResponse } from "next/server"

interface PasswordAuthRequestBody {
  email?: unknown
  password?: unknown
  turnstileToken?: unknown
}

function getInvalidPayloadResponse() {
  return NextResponse.json(
    { error: "Email and password are required" },
    { status: 400 },
  )
}

async function readPasswordAuthRequestBody(
  request: NextRequest,
): Promise<PasswordAuthRequestBody | null> {
  try {
    const body = (await request.json()) as unknown

    if (!body || typeof body !== "object") {
      return null
    }

    return body as PasswordAuthRequestBody
  } catch {
    return null
  }
}

function normalizeCredentials(body: PasswordAuthRequestBody): {
  email: string
  password: string
} | null {
  if (typeof body.email !== "string" || typeof body.password !== "string") {
    return null
  }

  const email = body.email.trim()

  if (!email || !body.password) {
    return null
  }

  return {
    email,
    password: body.password,
  }
}

function getServerAuthFailureResponse(error: unknown) {
  if (error instanceof FirebasePasswordAuthError) {
    return NextResponse.json(
      {
        code: error.code,
        error: error.message,
      },
      { status: error.status },
    )
  }

  const message = error instanceof Error ? error.message : "Unknown error"

  console.error("Password auth route failed:", message)

  return NextResponse.json(
    { error: "Authentication service temporarily unavailable" },
    { status: 503 },
  )
}

export async function handlePasswordAuthRequest(
  request: NextRequest,
  operation: FirebasePasswordAuthOperation,
) {
  const body = await readPasswordAuthRequestBody(request)

  if (!body) {
    return getInvalidPayloadResponse()
  }

  const turnstileValid = await verifyTurnstileToken({
    token: body.turnstileToken,
    remoteip: getTurnstileRemoteIp(request.headers),
  })

  if (!turnstileValid) {
    return NextResponse.json(
      { error: TURNSTILE_SECURITY_ERROR },
      { status: 400 },
    )
  }

  const credentials = normalizeCredentials(body)

  if (!credentials) {
    return getInvalidPayloadResponse()
  }

  try {
    const authResult = await authenticateWithEmailAndPassword({
      ...credentials,
      operation,
    })
    const sessionCookie = await createSessionCookie(authResult.idToken)

    if (!sessionCookie) {
      return NextResponse.json(
        { error: "Authentication service temporarily unavailable" },
        { status: 503 },
      )
    }

    await setFirebaseSessionCookie(sessionCookie)

    return NextResponse.json({
      customToken: authResult.customToken,
      uid: authResult.uid,
    })
  } catch (error) {
    return getServerAuthFailureResponse(error)
  }
}
