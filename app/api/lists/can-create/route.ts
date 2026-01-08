import { adminAuth } from "@/lib/firebase/admin"
import { getApps } from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"
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
    // Get session cookie
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get("session")?.value

    if (!sessionCookie || !adminAuth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify session and get user ID
    const decodedClaims = await adminAuth.verifySessionCookie(
      sessionCookie,
      true,
    )
    const userId = decodedClaims.uid

    // Get Firestore instance from admin SDK
    const apps = getApps()
    const app = apps.length > 0 ? apps[0] : undefined

    if (!app) {
      console.error("Firebase Admin app not initialized")
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 },
      )
    }

    const db = getFirestore(app)

    // Check user's premium status
    const userDoc = await db.collection("users").doc(userId).get()
    const userData = userDoc.data()
    const isPremium = userData?.premium?.isPremium ?? false

    // Premium users can always create lists
    if (isPremium) {
      return NextResponse.json({
        canCreate: true,
        currentCount: 0, // Not relevant for premium users
        limit: null,
      })
    }

    // Count custom lists for free users
    const listsSnapshot = await db
      .collection("users")
      .doc(userId)
      .collection("lists")
      .where("isCustom", "==", true)
      .get()

    const currentCount = listsSnapshot.size

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
