import { beforeEach, describe, expect, it, vi } from "vitest"

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
      new Request("https://showseek.test/api/auth/session", {
        body: JSON.stringify({ idToken: "invalid-id-token" }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      }) as never,
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
      new Request("https://showseek.test/api/auth/session", {
        body: JSON.stringify({ idToken: "valid-id-token" }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      }) as never,
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
      new Request("https://showseek.test/api/auth/session", {
        body: JSON.stringify({ idToken: "valid-id-token" }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      }) as never,
    )

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      error: "Authentication service temporarily unavailable",
    })
  })
})
