import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const passwordAuthMocks = vi.hoisted(() => ({
  createFirebaseCustomTokenMock: vi.fn(),
}))

vi.mock("@/lib/firebase/server-api", () => ({
  createFirebaseCustomToken: passwordAuthMocks.createFirebaseCustomTokenMock,
}))

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

describe("firebase password auth helper", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_API_KEY", "firebase-web-api-key")
    passwordAuthMocks.createFirebaseCustomTokenMock.mockReset()
    passwordAuthMocks.createFirebaseCustomTokenMock.mockResolvedValue(
      "firebase-custom-token",
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("signs in with Identity Toolkit and returns a custom token", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        idToken: "identity-platform-id-token",
        localId: "user-1",
      }),
    )

    vi.stubGlobal("fetch", fetchMock)

    const { authenticateWithEmailAndPassword } =
      await import("../lib/firebase/password-auth")

    await expect(
      authenticateWithEmailAndPassword({
        email: "user@example.com",
        operation: "login",
        password: "secret123",
      }),
    ).resolves.toEqual({
      customToken: "firebase-custom-token",
      idToken: "identity-platform-id-token",
      uid: "user-1",
    })
    expect(fetchMock).toHaveBeenCalledWith(
      "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=firebase-web-api-key",
      expect.objectContaining({
        body: JSON.stringify({
          email: "user@example.com",
          password: "secret123",
          returnSecureToken: true,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
        signal: expect.any(AbortSignal),
      }),
    )
    expect(
      passwordAuthMocks.createFirebaseCustomTokenMock,
    ).toHaveBeenCalledWith("user-1")
  })

  it("maps signup email collisions to Firebase-compatible errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({ error: { message: "EMAIL_EXISTS" } }, 400),
      ),
    )

    const { authenticateWithEmailAndPassword, FirebasePasswordAuthError } =
      await import("../lib/firebase/password-auth")

    await expect(
      authenticateWithEmailAndPassword({
        email: "user@example.com",
        operation: "signup",
        password: "secret123",
      }),
    ).rejects.toMatchObject({
      code: "auth/email-already-in-use",
      message:
        "An account with this email already exists. Try signing in again or use the original sign-in method.",
      status: 409,
    })
    await expect(
      authenticateWithEmailAndPassword({
        email: "user@example.com",
        operation: "signup",
        password: "secret123",
      }),
    ).rejects.toBeInstanceOf(FirebasePasswordAuthError)
  })
})
