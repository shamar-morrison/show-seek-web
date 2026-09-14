import {
  isSessionVerificationUnavailable,
  isSessionVerificationValid,
  verifySessionCookieValue,
} from "@/lib/firebase/server-auth"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

const POLAR_API_BASE = "https://api.polar.sh/v1"

async function handlePortalRequest(request: NextRequest) {
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
    const accessToken = process.env.POLAR_ACCESS_TOKEN?.trim()

    if (!accessToken) {
      console.error("POLAR_ACCESS_TOKEN is not configured")
      return NextResponse.json(
        { error: "Payment service temporarily unavailable" },
        { status: 503 },
      )
    }

    const response = await fetch(`${POLAR_API_BASE}/customer-sessions/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        external_customer_id: userId,
      }),
      cache: "no-store",
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Polar customer session creation failed:", {
        status: response.status,
        body: errorText,
      })
      return NextResponse.json(
        { error: "Failed to create portal session" },
        { status: 502 },
      )
    }

    const data = (await response.json()) as {
      customer_portal_url?: string
      customerPortalUrl?: string
      token?: string
    }

    const portalUrl =
      data.customer_portal_url ||
      data.customerPortalUrl ||
      (data.token
        ? `https://polar.sh/purchases?customer_session_token=${encodeURIComponent(data.token)}`
        : null)

    if (!portalUrl) {
      console.error("Polar response did not contain customer portal URL:", data)
      return NextResponse.json(
        { error: "Invalid response from payment provider" },
        { status: 502 },
      )
    }

    // Return redirect for standard browser requests
    const acceptHeader = request.headers.get("accept") ?? ""
    if (request.method === "GET" || acceptHeader.includes("text/html")) {
      return NextResponse.redirect(portalUrl, 303)
    }

    return NextResponse.json({ url: portalUrl })
  } catch (error) {
    console.error("Error creating Polar customer portal session:", error)
    return NextResponse.json(
      { error: "Failed to open customer portal" },
      { status: 500 },
    )
  }
}

export async function GET(request: NextRequest) {
  return handlePortalRequest(request)
}

export async function POST(request: NextRequest) {
  return handlePortalRequest(request)
}
