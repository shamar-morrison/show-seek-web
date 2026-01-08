import { adminAuth } from "@/lib/firebase/admin"
import { NextRequest, NextResponse } from "next/server"

/**
 * Validates a session cookie's signature and expiry.
 * Called by middleware to verify sessions in Edge Runtime.
 */
export async function POST(request: NextRequest) {
  try {
    const { sessionCookie } = await request.json()

    if (!sessionCookie || !adminAuth) {
      return NextResponse.json({ valid: false })
    }

    // Verify session cookie signature and check if it's revoked
    const decodedClaims = await adminAuth.verifySessionCookie(
      sessionCookie,
      true, // Check if revoked
    )

    return NextResponse.json({ valid: !!decodedClaims })
  } catch {
    // Any verification error means invalid session
    return NextResponse.json({ valid: false })
  }
}
