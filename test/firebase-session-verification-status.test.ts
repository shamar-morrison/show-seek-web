import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const getFirebaseProjectIdMock = vi.fn(() => "showseek-project")
const getFirebaseServiceAccountConfigMock = vi.fn(() => ({
  clientEmail: "service-account@example.com",
  privateKey: "private-key",
  projectId: "showseek-project",
}))
const getGoogleAccessTokenMock = vi.fn(async () => "google-access-token")

vi.mock("@/lib/firebase/server-api", () => ({
  getFirebaseProjectId: getFirebaseProjectIdMock,
  getFirebaseServiceAccountConfig: getFirebaseServiceAccountConfigMock,
  getGoogleAccessToken: getGoogleAccessTokenMock,
}))

function encodeBase64Url(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url")
}

function createSessionCookieToken(
  overrides: Partial<Record<string, unknown>> = {},
): string {
  const header = { alg: "RS256", kid: "kid-1" }
  const payload = {
    aud: "showseek-project",
    auth_time: 1_700_000_000,
    exp: 1_900_000_000,
    iat: 1_700_000_100,
    iss: "https://session.firebase.google.com/showseek-project",
    sub: "user-123",
    ...overrides,
  }

  return `${encodeBase64Url(header)}.${encodeBase64Url(payload)}.${Buffer.from(
    "signature",
  ).toString("base64url")}`
}

describe("firebase session verification status", () => {
  beforeEach(() => {
    vi.resetModules()
    getFirebaseProjectIdMock.mockReset()
    getFirebaseServiceAccountConfigMock.mockReset()
    getGoogleAccessTokenMock.mockReset()
    getFirebaseProjectIdMock.mockReturnValue("showseek-project")
    getFirebaseServiceAccountConfigMock.mockReturnValue({
      clientEmail: "service-account@example.com",
      privateKey: "private-key",
      projectId: "showseek-project",
    })
    getGoogleAccessTokenMock.mockResolvedValue("google-access-token")

    vi.stubGlobal("crypto", {
      subtle: {
        importKey: vi.fn(async () => ({}) as Promise<CryptoKey>),
        verify: vi.fn(async () => true),
      },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("marks malformed session cookies as invalid", async () => {
    const { verifySessionCookieValue } = await import(
      "../lib/firebase/server-auth"
    )

    const result = await verifySessionCookieValue("not-a-jwt", "local")

    expect(result).toEqual({
      account: null,
      status: "invalid",
      claims: null,
      reason: "Session cookie is not a valid JWT",
    })
  })

  it("sends a numeric string validDuration when creating session cookies", async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ sessionCookie: "session-cookie" }), {
        status: 200,
      })
    })

    vi.stubGlobal("fetch", fetchMock)

    const { createSessionCookie } = await import("../lib/firebase/server-auth")
    const sessionCookie = await createSessionCookie("valid-id-token")

    expect(sessionCookie).toBe("session-cookie")
    expect(fetchMock).toHaveBeenCalledWith(
      "https://identitytoolkit.googleapis.com/v1/projects/showseek-project:createSessionCookie",
      expect.objectContaining({
        body: JSON.stringify({
          idToken: "valid-id-token",
          validDuration: "432000",
        }),
        headers: expect.objectContaining({
          Authorization: "Bearer google-access-token",
          "Content-Type": "application/json",
        }),
        method: "POST",
      }),
    )
  })

  it("includes the looked-up account on successful strict verification", async () => {
    const fetchMock = vi.fn(async (input: string) => {
      if (input.includes("service_accounts")) {
        return new Response(
          JSON.stringify({
            keys: [
              {
                alg: "RS256",
                e: "AQAB",
                kid: "kid-1",
                kty: "RSA",
                n: "abc",
              },
            ],
          }),
          {
            headers: {
              "cache-control": "public, max-age=3600",
            },
            status: 200,
          },
        )
      }

      if (input.includes("accounts:lookup")) {
        return new Response(
          JSON.stringify({
            users: [{ localId: "user-123", validSince: "1700000000" }],
          }),
          { status: 200 },
        )
      }

      throw new Error(`Unexpected fetch: ${input}`)
    })

    vi.stubGlobal("fetch", fetchMock)

    const { verifySessionCookieValue } = await import(
      "../lib/firebase/server-auth"
    )

    const result = await verifySessionCookieValue(
      createSessionCookieToken(),
      "strict",
    )

    expect(result).toEqual({
      account: {
        localId: "user-123",
        validSince: "1700000000",
      },
      claims: {
        aud: "showseek-project",
        auth_time: 1_700_000_000,
        exp: 1_900_000_000,
        iat: 1_700_000_100,
        iss: "https://session.firebase.google.com/showseek-project",
        sub: "user-123",
      },
      reason: null,
      status: "valid",
    })
  })

  it("marks strict verification as unavailable when account lookup fails", async () => {
    const fetchMock = vi.fn(async (input: string) => {
      if (input.includes("service_accounts")) {
        return new Response(
          JSON.stringify({
            keys: [
              {
                alg: "RS256",
                e: "AQAB",
                kid: "kid-1",
                kty: "RSA",
                n: "abc",
              },
            ],
          }),
          {
            headers: {
              "cache-control": "public, max-age=3600",
            },
            status: 200,
          },
        )
      }

      if (input.includes("accounts:lookup")) {
        return new Response("backend unavailable", { status: 500 })
      }

      throw new Error(`Unexpected fetch: ${input}`)
    })

    vi.stubGlobal("fetch", fetchMock)

    const { verifySessionCookieValue } = await import(
      "../lib/firebase/server-auth"
    )

    const result = await verifySessionCookieValue(
      createSessionCookieToken(),
      "strict",
    )

    expect(result).toEqual(
      expect.objectContaining({
        account: null,
        status: "unavailable",
      }),
    )
    expect(result.reason).toContain("Failed to look up Firebase account")
  })
})
