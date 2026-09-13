import { beforeEach, describe, expect, it, vi } from "vitest"

const cookiesMock = vi.fn()
const verifySessionCookieValueMock = vi.fn()
const getUserPremiumStatusMock = vi.fn()
const countNotesMock = vi.fn()

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
  countNotes: countNotesMock,
  getUserPremiumStatus: getUserPremiumStatusMock,
}))

describe("GET /api/notes/can-create", () => {
  beforeEach(() => {
    cookiesMock.mockReset()
    verifySessionCookieValueMock.mockReset()
    getUserPremiumStatusMock.mockReset()
    countNotesMock.mockReset()
    cookiesMock.mockResolvedValue({
      get: () => ({ value: "session-cookie" }),
    })
  })

  it("returns 401 when the session cookie is missing", async () => {
    cookiesMock.mockResolvedValue({
      get: () => undefined,
    })

    const { GET } = await import("../app/api/notes/can-create/route")
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

    const { GET } = await import("../app/api/notes/can-create/route")
    const response = await GET()

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      error: "Unauthorized",
    })
  })

  it("returns unlimited create access for premium users", async () => {
    verifySessionCookieValueMock.mockResolvedValue({
      status: "valid",
      claims: { sub: "user-1" },
      reason: null,
    })
    getUserPremiumStatusMock.mockResolvedValue(true)

    const { GET } = await import("../app/api/notes/can-create/route")
    const response = await GET()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      canCreate: true,
      currentCount: 0,
      limit: null,
    })
    expect(countNotesMock).not.toHaveBeenCalled()
  })

  it("returns canCreate true for free users below the notes limit", async () => {
    verifySessionCookieValueMock.mockResolvedValue({
      status: "valid",
      claims: { sub: "user-1" },
      reason: null,
    })
    getUserPremiumStatusMock.mockResolvedValue(false)
    countNotesMock.mockResolvedValue(14)

    const { GET } = await import("../app/api/notes/can-create/route")
    const response = await GET()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      canCreate: true,
      currentCount: 14,
      limit: 15,
    })
  })

  it("returns canCreate false for free users at the notes limit", async () => {
    verifySessionCookieValueMock.mockResolvedValue({
      status: "valid",
      claims: { sub: "user-1" },
      reason: null,
    })
    getUserPremiumStatusMock.mockResolvedValue(false)
    countNotesMock.mockResolvedValue(15)

    const { GET } = await import("../app/api/notes/can-create/route")
    const response = await GET()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      canCreate: false,
      currentCount: 15,
      limit: 15,
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

    const { GET } = await import("../app/api/notes/can-create/route")
    const response = await GET()

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      error: "Failed to check note permission",
    })
  })
})
