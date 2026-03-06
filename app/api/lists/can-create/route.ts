import {
  countCustomLists,
  getUserPremiumStatus,
} from "@/lib/firebase/server-firestore"
import { verifySessionCookieValue } from "@/lib/firebase/server-auth"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

const FREE_USER_LIST_LIMIT = 5

/**
 * GET /api/lists/can-create
 * Checks if the current user can create a new custom list.
 * Returns { canCreate: boolean, currentCount: number, limit: number | null }
 * - Premium users always get canCreate: true with limit: null
 * - Free users get canCreate: true if currentCount < 5
 */
export async function GET() {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get("session")?.value

    if (!sessionCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const decodedClaims = await verifySessionCookieValue(sessionCookie, true)

    if (!decodedClaims) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = decodedClaims.sub
    const isPremium = await getUserPremiumStatus(userId)

    // Premium users can always create lists
    if (isPremium) {
      return NextResponse.json({
        canCreate: true,
        currentCount: 0, // Not relevant for premium users
        limit: null,
      })
    }

    const currentCount = await countCustomLists(userId)

    return NextResponse.json({
      canCreate: currentCount < FREE_USER_LIST_LIMIT,
      currentCount,
      limit: FREE_USER_LIST_LIMIT,
    })
  } catch (error) {
    console.error("Error checking list creation permission:", error)
    return NextResponse.json(
      { error: "Failed to check list permission" },
      { status: 500 },
    )
  }
}
