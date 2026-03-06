import { verifySessionCookieValue } from "@/lib/firebase/server-auth"
import { NextRequest, NextResponse } from "next/server"

/**
 * Validates a session cookie's signature and expiry.
 * Called by middleware to verify sessions in Edge Runtime.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { sessionCookie?: string }
    const sessionCookie = body.sessionCookie

    if (!sessionCookie) {
      return NextResponse.json({ valid: false })
    }

    const decodedClaims = await verifySessionCookieValue(sessionCookie, true)

    return NextResponse.json({ valid: !!decodedClaims })
  } catch {
    // Any verification error means invalid session
    return NextResponse.json({ valid: false })
  }
}
