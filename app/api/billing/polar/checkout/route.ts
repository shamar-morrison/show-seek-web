import {
  isSessionVerificationUnavailable,
  isSessionVerificationValid,
  verifySessionCookieValue,
} from "@/lib/firebase/server-auth"
import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

const POLAR_API_BASE = "https://api.polar.sh/v1"

function getPolarConfig() {
  const accessToken = process.env.POLAR_ACCESS_TOKEN?.trim()
  const monthlyProductId = process.env.POLAR_PRODUCT_ID_MONTHLY?.trim()
  const yearlyProductId = process.env.POLAR_PRODUCT_ID_YEARLY?.trim()

  return {
    accessToken,
    monthlyProductId,
    yearlyProductId,
  }
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get("session")?.value

    if (!sessionCookie) {
      console.warn("[AUTH DEBUG] Checkout route: no session cookie present in cookieStore")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const verification = await verifySessionCookieValue(sessionCookie, "strict")

    if (isSessionVerificationUnavailable(verification)) {
      console.warn("[AUTH DEBUG] Checkout route: verification unavailable:", verification.reason)
      return NextResponse.json(
        { error: "Authentication temporarily unavailable" },
        { status: 503 },
      )
    }

    if (!isSessionVerificationValid(verification)) {
      console.warn("[AUTH DEBUG] Checkout route: verification invalid:", {
        status: verification.status,
        reason: verification.reason,
      })
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = verification.claims.sub
    const userEmail =
      (typeof verification.claims.email === "string"
        ? verification.claims.email
        : null) ||
      (typeof verification.account?.email === "string"
        ? verification.account.email
        : null)

    const { searchParams } = new URL(request.url)
    const plan = searchParams.get("plan")?.toLowerCase()

    if (plan !== "monthly" && plan !== "yearly") {
      return NextResponse.json(
        { error: "Invalid plan parameter. Must be 'monthly' or 'yearly'" },
        { status: 400 },
      )
    }

    const config = getPolarConfig()

    if (!config.accessToken) {
      console.error("POLAR_ACCESS_TOKEN is not configured")
      return NextResponse.json(
        { error: "Payment service temporarily unavailable" },
        { status: 503 },
      )
    }

    const polarProductId =
      plan === "monthly" ? config.monthlyProductId : config.yearlyProductId

    if (!polarProductId) {
      console.error(`Polar product ID for plan '${plan}' is not configured`)
      return NextResponse.json(
        { error: "Selected plan is currently unavailable" },
        { status: 503 },
      )
    }

    const origin = request.nextUrl.origin
    const successUrl = `${origin}/profile?checkout=success`

    const checkoutRequestBody: {
      products: string[]
      success_url: string
      external_customer_id: string
      customer_email?: string
    } = {
      products: [polarProductId],
      success_url: successUrl,
      external_customer_id: userId,
    }

    if (userEmail) {
      checkoutRequestBody.customer_email = userEmail
    }

    const response = await fetch(`${POLAR_API_BASE}/checkouts/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(checkoutRequestBody),
      cache: "no-store",
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Polar checkout session creation failed:", {
        status: response.status,
        body: errorText,
      })
      return NextResponse.json(
        { error: "Failed to create checkout session" },
        { status: 502 },
      )
    }

    const data = (await response.json()) as { url?: string }
    const checkoutUrl = data.url

    if (!checkoutUrl) {
      console.error("Polar response did not contain a checkout URL:", data)
      return NextResponse.json(
        { error: "Invalid response from payment provider" },
        { status: 502 },
      )
    }

    return NextResponse.redirect(checkoutUrl, 303)
  } catch (error) {
    console.error("Error initiating Polar checkout:", error)
    return NextResponse.json(
      { error: "Failed to initiate checkout" },
      { status: 500 },
    )
  }
}
