import { adminAuth } from "@/lib/firebase/admin"
import { getAuthorizationUrl } from "@/lib/trakt"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    // Get session cookie
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get("session")?.value

    if (!sessionCookie || !adminAuth) {
      return NextResponse.redirect(
        new URL(
          "/login",
          process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        ),
      )
    }

    // Verify the session and get user ID
    const decodedToken = await adminAuth.verifySessionCookie(
      sessionCookie,
      true,
    )
    const userId = decodedToken.uid

    // Get the authorization URL and redirect
    const authUrl = getAuthorizationUrl(userId)
    return NextResponse.redirect(authUrl)
  } catch (error) {
    console.error("Trakt auth error:", error)
    return NextResponse.redirect(
      new URL(
        "/profile?trakt=error",
        process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      ),
    )
  }
}
