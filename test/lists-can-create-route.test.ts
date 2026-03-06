import { beforeEach, describe, expect, it, vi } from "vitest"

const cookiesMock = vi.fn()
const verifySessionCookieValueMock = vi.fn()
const getUserPremiumStatusMock = vi.fn()
const countCustomListsMock = vi.fn()

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}))

vi.mock("@/lib/firebase/server-auth", () => ({
  isSessionVerificationUnavailable: (result: { status: string }) =>
    result.status === "unavailable",
  isSessionVerificationValid: (result: { status: string }) =>
    result.status === "valid",
  verifySessionCookieValue: verifySessionCookieValueMock,
}))

vi.mock("@/lib/firebase/server-firestore", () => ({
  countCustomLists: countCustomListsMock,
  getUserPremiumStatus: getUserPremiumStatusMock,
}))

describe("GET /api/lists/can-create", () => {
  beforeEach(() => {
    cookiesMock.mockReset()
    verifySessionCookieValueMock.mockReset()
    getUserPremiumStatusMock.mockReset()
    countCustomListsMock.mockReset()
    cookiesMock.mockResolvedValue({
      get: () => ({ value: "session-cookie" }),
    })
  })

  it("returns 503 when strict session verification is temporarily unavailable", async () => {
    verifySessionCookieValueMock.mockResolvedValue({
      status: "unavailable",
      claims: null,
      reason: "Google access token is unavailable",
    })

    const { GET } = await import("../app/api/lists/can-create/route")
    const response = await GET()

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      error: "Authentication temporarily unavailable",
    })
  })
})
