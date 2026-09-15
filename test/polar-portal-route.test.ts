import { beforeEach, describe, expect, it, vi } from "vitest"
import { GET, POST } from "@/app/api/billing/polar/portal/route"
import { NextRequest } from "next/server"

const verifySessionCookieValueMock = vi.fn()
const cookiesMock = vi.fn()

vi.mock("@/lib/firebase/server-auth", () => ({
  isSessionVerificationUnavailable: vi.fn(
    (verification) => verification?.status === "unavailable",
  ),
  isSessionVerificationValid: vi.fn(
    (verification) => verification?.status === "valid",
  ),
  verifySessionCookieValue: (...args: unknown[]) =>
    verifySessionCookieValueMock(...args),
}))

vi.mock("next/headers", () => ({
  cookies: () => cookiesMock(),
}))

describe("Polar Customer Portal Route", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    process.env.POLAR_ACCESS_TOKEN = "polar_oat_portal_test"
  })

  it("returns 401 when session cookie is missing", async () => {
    cookiesMock.mockResolvedValue({
      get: vi.fn(() => undefined),
    })

    const request = new NextRequest("https://example.com/api/billing/polar/portal")
    const response = await GET(request)

    expect(response.status).toBe(401)
  })

  it("redirects to customer portal URL on browser GET request", async () => {
    cookiesMock.mockResolvedValue({
      get: vi.fn(() => ({ value: "valid-session" })),
    })
    verifySessionCookieValueMock.mockResolvedValue({
      status: "valid",
      claims: { sub: "user-456" },
    })

    let capturedBody: any
    const fetchMock = vi.fn(async (url: string, init: any) => {
      capturedBody = JSON.parse(init.body)
      return {
        ok: true,
        status: 200,
        json: async () => ({
          customer_portal_url: "https://polar.sh/purchases?portal=token_abc",
        }),
      }
    })
    globalThis.fetch = fetchMock as any

    const request = new NextRequest("https://example.com/api/billing/polar/portal", {
      headers: { accept: "text/html" },
    })
    const response = await GET(request)

    expect(response.status).toBe(303)
    expect(response.headers.get("location")).toBe(
      "https://polar.sh/purchases?portal=token_abc",
    )
    expect(capturedBody).toEqual({
      external_customer_id: "user-456",
    })
  })

  it("returns JSON with customer portal URL on POST API request", async () => {
    cookiesMock.mockResolvedValue({
      get: vi.fn(() => ({ value: "valid-session" })),
    })
    verifySessionCookieValueMock.mockResolvedValue({
      status: "valid",
      claims: { sub: "user-456" },
    })

    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        token: "session_token_xyz",
      }),
    }))
    globalThis.fetch = fetchMock as any

    const request = new NextRequest("https://example.com/api/billing/polar/portal", {
      method: "POST",
      headers: { "content-type": "application/json" },
    })
    const response = await POST(request)

    expect(response.status).toBe(200)
    const data = (await response.json()) as any
    expect(data.url).toBe(
      "https://polar.sh/purchases?customer_session_token=session_token_xyz",
    )
  })
})
