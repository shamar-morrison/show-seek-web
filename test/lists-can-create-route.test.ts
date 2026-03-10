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

  it("returns 401 when the session cookie is missing", async () => {
    cookiesMock.mockResolvedValue({
      get: () => undefined,
    })

    const { GET } = await import("../app/api/lists/can-create/route")
    const response = await GET()

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      error: "Unauthorized",
    })
  })

  it("returns 401 when strict session verification is invalid", async () => {
    verifySessionCookieValueMock.mockResolvedValue({
      status: "invalid",
      claims: null,
      reason: "Session cookie has expired",
    })

    const { GET } = await import("../app/api/lists/can-create/route")
    const response = await GET()

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      error: "Unauthorized",
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

  it("returns unlimited create access for premium users", async () => {
    verifySessionCookieValueMock.mockResolvedValue({
      status: "valid",
      claims: { sub: "user-1" },
      reason: null,
    })
    getUserPremiumStatusMock.mockResolvedValue(true)

    const { GET } = await import("../app/api/lists/can-create/route")
    const response = await GET()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      canCreate: true,
      currentCount: 0,
      limit: null,
    })
  })

  it("returns canCreate true for free users below the list limit", async () => {
    verifySessionCookieValueMock.mockResolvedValue({
      status: "valid",
      claims: { sub: "user-1" },
      reason: null,
    })
    getUserPremiumStatusMock.mockResolvedValue(false)
    countCustomListsMock.mockResolvedValue(3)

    const { GET } = await import("../app/api/lists/can-create/route")
    const response = await GET()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      canCreate: true,
      currentCount: 3,
      limit: 5,
    })
  })

  it("returns canCreate false for free users at the list limit", async () => {
    verifySessionCookieValueMock.mockResolvedValue({
      status: "valid",
      claims: { sub: "user-1" },
      reason: null,
    })
    getUserPremiumStatusMock.mockResolvedValue(false)
    countCustomListsMock.mockResolvedValue(5)

    const { GET } = await import("../app/api/lists/can-create/route")
    const response = await GET()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      canCreate: false,
      currentCount: 5,
      limit: 5,
    })
  })

  it("returns 500 when the Firestore helper throws", async () => {
    verifySessionCookieValueMock.mockResolvedValue({
      status: "valid",
      claims: { sub: "user-1" },
      reason: null,
    })
    getUserPremiumStatusMock.mockRejectedValue(
      new Error("Missing Firebase service account configuration"),
    )

    const { GET } = await import("../app/api/lists/can-create/route")
    const response = await GET()

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      error: "Failed to check list permission",
    })
  })
})
