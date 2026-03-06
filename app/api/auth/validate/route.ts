import {
  isSessionVerificationValid,
  isSessionVerificationUnavailable,
  verifySessionCookieValue,
} from "@/lib/firebase/server-auth"
import { NextRequest, NextResponse } from "next/server"

/**
 * Validates a session cookie using strict verification.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { sessionCookie?: string }
    const sessionCookie = body.sessionCookie

    if (!sessionCookie) {
      return NextResponse.json({ valid: false, status: "invalid" })
    }

    const verification = await verifySessionCookieValue(sessionCookie, "strict")

    if (isSessionVerificationUnavailable(verification)) {
      return NextResponse.json(
        {
          valid: false,
          status: verification.status,
          reason: verification.reason,
        },
        { status: 503 },
      )
    }

    return NextResponse.json({
      valid: isSessionVerificationValid(verification),
      status: verification.status,
    })
  } catch {
    return NextResponse.json(
      {
        valid: false,
        status: "unavailable",
      },
      { status: 503 },
    )
  }
}
