import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const cookiesMock = vi.fn()
const createSessionCookieMock = vi.fn()

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}))

vi.mock("@/lib/firebase/session", () => ({
  createSessionCookie: createSessionCookieMock,
  SESSION_COOKIE_NAME: "session",
  SESSION_EXPIRY_DAYS: 5,
}))

function createTestRequest({
  body,
  headers,
  method = "POST",
  url = "https://showseek.test/api/auth/session",
}: {
  body?: Record<string, unknown>
  headers?: HeadersInit
  method?: string
  url?: string
}): NextRequest {
  const requestHeaders = new Headers(headers)
  if (!requestHeaders.has("Content-Type")) {
    requestHeaders.set("Content-Type", "application/json")
  }

  return new NextRequest(url, {
    body: body ? JSON.stringify(body) : undefined,
    headers: requestHeaders,
    method,
  })
}

describe("POST /api/auth/session", () => {
  beforeEach(() => {
    cookiesMock.mockReset()
    createSessionCookieMock.mockReset()
    cookiesMock.mockResolvedValue({
      set: vi.fn(),
    })
  })

  it("returns 401 for definitely invalid ID tokens", async () => {
    createSessionCookieMock.mockRejectedValue(
      new Error(
        'Failed to create session cookie: {"error":{"code":400,"message":"INVALID_ID_TOKEN"}}',
      ),
    )

    const { POST } = await import("../app/api/auth/session/route")
    const response = await POST(
      createTestRequest({
        body: { idToken: "invalid-id-token" },
      }),
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      error: "Invalid authentication token",
    })
  })

  it("returns 503 for temporary session creation backend failures", async () => {
    createSessionCookieMock.mockRejectedValue(
      new Error("Failed to fetch Google access token: backend unavailable"),
    )

    const { POST } = await import("../app/api/auth/session/route")
    const response = await POST(
      createTestRequest({
        body: { idToken: "valid-id-token" },
      }),
    )

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      error: "Authentication service temporarily unavailable",
    })
  })

  it("returns 503 for invalid session creation request payloads from Google", async () => {
    createSessionCookieMock.mockRejectedValue(
      new Error(
        `Failed to create session cookie: {"error":{"code":400,"message":"Invalid value at 'valid_duration' (TYPE_INT64), \\"432000s\\"","status":"INVALID_ARGUMENT"}}`,
      ),
    )

    const { POST } = await import("../app/api/auth/session/route")
    const response = await POST(
      createTestRequest({
        body: { idToken: "valid-id-token" },
      }),
    )

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      error: "Authentication service temporarily unavailable",
    })
  })

  it("creates a session and sets the session cookie for valid ID tokens", async () => {
    const setCookieSpy = vi.fn()
    cookiesMock.mockResolvedValue({ set: setCookieSpy })
    createSessionCookieMock.mockResolvedValue("valid-session-cookie")

    const { POST } = await import("../app/api/auth/session/route")
    const response = await POST(
      createTestRequest({
        body: { idToken: "valid-id-token" },
      }),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ success: true })
    expect(setCookieSpy).toHaveBeenCalledWith(
      "session",
      "valid-session-cookie",
      expect.objectContaining({
        httpOnly: true,
        maxAge: 5 * 24 * 60 * 60,
        path: "/",
        sameSite: "lax",
      }),
    )
  })
})
