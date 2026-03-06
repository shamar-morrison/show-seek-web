import {
  getInvalidSessionCookieReason,
  isSessionCookieRevoked,
  type DecodedSessionCookie,
  type FirebaseAccountInfo,
} from "@/lib/firebase/server-auth"
import { describe, expect, it } from "vitest"

function createDecodedSessionCookie(
  overrides: Partial<DecodedSessionCookie> = {},
): DecodedSessionCookie {
  return {
    aud: "showseek-project",
    auth_time: 1_700_000_000,
    exp: 1_900_000_000,
    iat: 1_700_000_100,
    iss: "https://session.firebase.google.com/showseek-project",
    sub: "user-123",
    ...overrides,
  }
}

function createFirebaseAccount(
  overrides: Partial<FirebaseAccountInfo> = {},
): FirebaseAccountInfo {
  return {
    localId: "user-123",
    ...overrides,
  }
}

describe("firebase server auth helpers", () => {
  it("accepts a valid session cookie payload", () => {
    const payload = createDecodedSessionCookie()

    expect(
      getInvalidSessionCookieReason(payload, "showseek-project", 1_800_000_000),
    ).toBeNull()
  })

  it("rejects invalid session cookie claims", () => {
    expect(
      getInvalidSessionCookieReason(
        createDecodedSessionCookie({ aud: "wrong-project" }),
        "showseek-project",
        1_800_000_000,
      ),
    ).toBe("Invalid audience")

    expect(
      getInvalidSessionCookieReason(
        createDecodedSessionCookie({ sub: "" }),
        "showseek-project",
        1_800_000_000,
      ),
    ).toBe("Invalid subject")

    expect(
      getInvalidSessionCookieReason(
        createDecodedSessionCookie({ exp: 1_700_000_001 }),
        "showseek-project",
        1_800_000_000,
      ),
    ).toBe("Session cookie has expired")
  })

  it("detects revoked session cookies using validSince", () => {
    const decodedCookie = createDecodedSessionCookie({ auth_time: 100 })

    expect(
      isSessionCookieRevoked(
        decodedCookie,
        createFirebaseAccount({ validSince: "101" }),
      ),
    ).toBe(true)

    expect(
      isSessionCookieRevoked(
        decodedCookie,
        createFirebaseAccount({ validSince: "100" }),
      ),
    ).toBe(false)

    expect(
      isSessionCookieRevoked(
        decodedCookie,
        createFirebaseAccount({ validSince: undefined }),
      ),
    ).toBe(false)
  })
})
