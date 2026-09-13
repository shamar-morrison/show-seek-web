import {
  countNotes,
  getUserPremiumStatus,
} from "@/lib/firebase/server-firestore"
import {
  isSessionVerificationUnavailable,
  isSessionVerificationValid,
  verifySessionCookieValue,
} from "@/lib/firebase/server-auth"
import { MAX_FREE_NOTES } from "@/lib/notes-limits"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

/**
 * GET /api/notes/can-create
 * Checks if the current user can create a new personal note.
 * Returns { canCreate: boolean, currentCount: number, limit: number | null }
 * - Premium users always get canCreate: true with limit: null
 * - Free users get canCreate: true if currentCount < MAX_FREE_NOTES
 * - Editing an existing note bypasses this check client-side
 */
export async function GET() {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get("session")?.value

    if (!sessionCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const verification = await verifySessionCookieValue(sessionCookie, "strict")

    if (isSessionVerificationUnavailable(verification)) {
      return NextResponse.json(
        { error: "Authentication temporarily unavailable" },
        { status: 503 },
      )
    }

    if (!isSessionVerificationValid(verification)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = verification.claims.sub
    const isPremium = await getUserPremiumStatus(userId)

    // Premium users can always create notes
    if (isPremium) {
      return NextResponse.json({
        canCreate: true,
        currentCount: 0, // Not relevant for premium users
        limit: null,
      })
    }

    const currentCount = await countNotes(userId)

    return NextResponse.json({
      canCreate: currentCount < MAX_FREE_NOTES,
      currentCount,
      limit: MAX_FREE_NOTES,
    })
  } catch (error) {
    console.error("Error checking note creation permission:", error)
    return NextResponse.json(
      { error: "Failed to check note permission" },
      { status: 500 },
    )
  }
}
