import { adminAuth, adminDb } from "@/lib/firebase/admin"
import { revokeToken } from "@/lib/trakt"
import { FieldValue } from "firebase-admin/firestore"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function POST() {
  try {
    // Get session cookie
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get("session")?.value

    if (!sessionCookie || !adminAuth || !adminDb) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify the session and get user ID
    const decodedToken = await adminAuth.verifySessionCookie(
      sessionCookie,
      true,
    )
    const userId = decodedToken.uid

    // Get current user document to revoke token
    const userDoc = await adminDb.doc(`users/${userId}`).get()

    if (userDoc.exists) {
      const data = userDoc.data()

      // Try to revoke the token (don't fail if this doesn't work)
      if (data?.traktAccessToken) {
        try {
          await revokeToken(data.traktAccessToken)
        } catch (e) {
          console.warn("Failed to revoke Trakt token:", e)
        }
      }

      // Remove Trakt fields from user document
      await adminDb.doc(`users/${userId}`).update({
        traktAccessToken: FieldValue.delete(),
        traktRefreshToken: FieldValue.delete(),
        traktTokenExpiresAt: FieldValue.delete(),
        traktConnectedAt: FieldValue.delete(),
        traktConnected: FieldValue.delete(),
        traktLastSyncAt: FieldValue.delete(),
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Trakt disconnect error:", error)
    return NextResponse.json({ error: "Failed to disconnect" }, { status: 500 })
  }
}
