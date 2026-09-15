import { beforeEach, describe, expect, it, vi } from "vitest"
import { GET } from "@/app/api/billing/polar/checkout/route"
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

describe("GET /api/billing/polar/checkout", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    process.env.POLAR_ACCESS_TOKEN = "polar_oat_test"
    process.env.POLAR_PRODUCT_ID_MONTHLY = "prod_polar_monthly_1"
    process.env.POLAR_PRODUCT_ID_YEARLY = "prod_polar_yearly_1"
  })

  it("returns 401 when session cookie is missing", async () => {
    cookiesMock.mockResolvedValue({
      get: vi.fn(() => undefined),
    })

    const request = new NextRequest(
      "https://example.com/api/billing/polar/checkout?plan=monthly",
    )
    const response = await GET(request)

    expect(response.status).toBe(401)
    const data = (await response.json()) as { error?: string }
    expect(data.error).toBe("Unauthorized")
  })

  it("returns 401 when session verification fails", async () => {
    cookiesMock.mockResolvedValue({
      get: vi.fn(() => ({ value: "invalid-session" })),
    })
    verifySessionCookieValueMock.mockResolvedValue({
      status: "invalid",
      claims: null,
    })

    const request = new NextRequest(
      "https://example.com/api/billing/polar/checkout?plan=monthly",
    )
    const response = await GET(request)

    expect(response.status).toBe(401)
  })

  it("returns 400 when plan parameter is missing or invalid", async () => {
    cookiesMock.mockResolvedValue({
      get: vi.fn(() => ({ value: "valid-session" })),
    })
    verifySessionCookieValueMock.mockResolvedValue({
      status: "valid",
      claims: { sub: "user-123" },
    })

    const request = new NextRequest(
      "https://example.com/api/billing/polar/checkout?plan=invalid",
    )
    const response = await GET(request)

    expect(response.status).toBe(400)
    const data = (await response.json()) as { error?: string }
    expect(data.error).toContain("Invalid plan parameter")
  })

  it("creates checkout session and redirects to returned URL on success", async () => {
    cookiesMock.mockResolvedValue({
      get: vi.fn(() => ({ value: "valid-session" })),
    })
    verifySessionCookieValueMock.mockResolvedValue({
      status: "valid",
      claims: { sub: "user-123", email: "user@example.com" },
    })

    let capturedBody: Record<string, unknown> | undefined
    let capturedHeaders: Record<string, string> | undefined
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      capturedBody = JSON.parse(init?.body as string)
      capturedHeaders = init?.headers as Record<string, string>
      return {
        ok: true,
        status: 200,
        json: async () => ({
          url: "https://polar.sh/checkout/chk_test123",
        }),
      }
    })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const request = new NextRequest(
      "https://example.com/api/billing/polar/checkout?plan=yearly",
    )
    const response = await GET(request)

    expect(response.status).toBe(303)
    expect(response.headers.get("location")).toBe(
      "https://polar.sh/checkout/chk_test123",
    )
    expect(capturedHeaders.Authorization).toBe("Bearer polar_oat_test")
    expect(capturedBody).toEqual({
      products: ["prod_polar_yearly_1"],
      success_url: "https://example.com/profile?checkout=success",
      external_customer_id: "user-123",
      customer_email: "user@example.com",
    })
  })
})
