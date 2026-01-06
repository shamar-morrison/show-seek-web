import {
  createSessionCookie,
  SESSION_COOKIE_NAME,
  SESSION_EXPIRY_DAYS,
} from "@/lib/firebase/session"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { idToken } = await request.json()

    if (!idToken) {
      return NextResponse.json({ error: "ID token required" }, { status: 400 })
    }

    const sessionCookie = await createSessionCookie(idToken)
    const cookieStore = await cookies()

    cookieStore.set(SESSION_COOKIE_NAME, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_EXPIRY_DAYS * 24 * 60 * 60, // 5 days in seconds
      path: "/",
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Session creation failed:", error)
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 401 },
    )
  }
}
