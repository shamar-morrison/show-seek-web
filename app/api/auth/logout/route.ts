import { SESSION_COOKIE_NAME } from "@/lib/firebase/session"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function POST() {
  const cookieStore = await cookies()

  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0, // Immediately expire
    path: "/",
  })

  return NextResponse.json({ success: true })
}
