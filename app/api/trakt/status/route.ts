import { adminAuth, adminDb } from "@/lib/firebase/admin"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    // Get session cookie
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get("session")?.value

    if (!sessionCookie || !adminAuth || !adminDb) {
      return NextResponse.json({ connected: false }, { status: 200 })
    }

    // Verify the session and get user ID
    const decodedToken = await adminAuth.verifySessionCookie(
      sessionCookie,
      true,
    )
    const userId = decodedToken.uid

    // Check user document for Trakt connection
    const userDoc = await adminDb.doc(`users/${userId}`).get()

    if (!userDoc.exists) {
      return NextResponse.json({ connected: false }, { status: 200 })
    }

    const data = userDoc.data()
    return NextResponse.json({
      connected: data?.traktConnected === true,
      lastSyncAt:
        data?.traktLastSyncAt?.toMillis?.() || data?.traktLastSyncAt || null,
      connectedAt:
        data?.traktConnectedAt?.toMillis?.() || data?.traktConnectedAt || null,
    })
  } catch (error) {
    console.error("Trakt status error:", error)
    return NextResponse.json({ connected: false }, { status: 200 })
  }
}
