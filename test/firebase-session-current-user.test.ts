import { beforeEach, describe, expect, it, vi } from "vitest"

const cookiesMock = vi.fn()
const lookupFirebaseAccountMock = vi.fn()
const verifySessionCookieValueMock = vi.fn()

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}))

vi.mock("@/lib/firebase/server-auth", () => ({
  SESSION_COOKIE_NAME: "session",
  SESSION_EXPIRY_DAYS: 5,
  createSessionCookie: vi.fn(),
  isSessionVerificationUnavailable: (result: { status: string }) =>
    result.status === "unavailable",
  isSessionVerificationValid: (result: { status: string }) =>
    result.status === "valid",
  lookupFirebaseAccount: lookupFirebaseAccountMock,
  verifySessionCookieValue: verifySessionCookieValueMock,
}))

describe("firebase session current user", () => {
  beforeEach(() => {
    vi.resetModules()
    cookiesMock.mockReset()
    lookupFirebaseAccountMock.mockReset()
    verifySessionCookieValueMock.mockReset()
    cookiesMock.mockResolvedValue({
      get: () => ({ value: "session-cookie" }),
    })
  })

  it("returns the verified account without performing a second lookup", async () => {
    const account = {
      localId: "user-123",
      validSince: "1700000000",
    }

    verifySessionCookieValueMock.mockResolvedValue({
      account,
      claims: { sub: "user-123" },
      reason: null,
      status: "valid",
    })

    const { getCurrentUser } = await import("../lib/firebase/session")

    await expect(getCurrentUser()).resolves.toEqual(account)
    expect(lookupFirebaseAccountMock).not.toHaveBeenCalled()
  })
})
