import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const passwordRouteMocks = vi.hoisted(() => {
  class TestFirebasePasswordAuthError extends Error {
    constructor(
      readonly code: string,
      message: string,
      readonly status: number,
    ) {
      super(message)
      this.name = "FirebasePasswordAuthError"
    }
  }

  return {
    TestFirebasePasswordAuthError,
    authenticateWithEmailAndPasswordMock: vi.fn(),
    createSessionCookieMock: vi.fn(),
    getTurnstileRemoteIpMock: vi.fn(),
    setFirebaseSessionCookieMock: vi.fn(),
    verifyTurnstileTokenMock: vi.fn(),
  }
})

vi.mock("@/lib/turnstile", () => ({
  TURNSTILE_SECURITY_ERROR: "Security check failed. Please try again.",
  getTurnstileRemoteIp: passwordRouteMocks.getTurnstileRemoteIpMock,
  verifyTurnstileToken: passwordRouteMocks.verifyTurnstileTokenMock,
}))

vi.mock("@/lib/firebase/password-auth", () => ({
  FirebasePasswordAuthError: passwordRouteMocks.TestFirebasePasswordAuthError,
  authenticateWithEmailAndPassword:
    passwordRouteMocks.authenticateWithEmailAndPasswordMock,
}))

vi.mock("@/lib/firebase/server-auth", () => ({
  createSessionCookie: passwordRouteMocks.createSessionCookieMock,
}))

vi.mock("@/lib/firebase/server-session-cookie", () => ({
  setFirebaseSessionCookie: passwordRouteMocks.setFirebaseSessionCookieMock,
}))

function createTestRequest({
  body,
  headers,
  url = "https://showseek.test/api/auth/login",
}: {
  body?: Record<string, unknown>
  headers?: HeadersInit
  url?: string
}): NextRequest {
  return new NextRequest(url, {
    body: body ? JSON.stringify(body) : undefined,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    method: "POST",
  })
}

describe("password auth routes", () => {
  beforeEach(() => {
    vi.resetModules()
    passwordRouteMocks.authenticateWithEmailAndPasswordMock.mockReset()
    passwordRouteMocks.createSessionCookieMock.mockReset()
    passwordRouteMocks.getTurnstileRemoteIpMock.mockReset()
    passwordRouteMocks.setFirebaseSessionCookieMock.mockReset()
    passwordRouteMocks.verifyTurnstileTokenMock.mockReset()

    passwordRouteMocks.getTurnstileRemoteIpMock.mockReturnValue("203.0.113.9")
    passwordRouteMocks.verifyTurnstileTokenMock.mockResolvedValue(true)
    passwordRouteMocks.authenticateWithEmailAndPasswordMock.mockResolvedValue({
      customToken: "custom-token",
      idToken: "identity-platform-id-token",
      uid: "user-1",
    })
    passwordRouteMocks.createSessionCookieMock.mockResolvedValue(
      "session-cookie",
    )
    passwordRouteMocks.setFirebaseSessionCookieMock.mockResolvedValue(undefined)
  })

  it("rejects invalid Turnstile tokens before Firebase auth runs", async () => {
    passwordRouteMocks.verifyTurnstileTokenMock.mockResolvedValue(false)

    const { POST } = await import("../app/api/auth/login/route")
    const response = await POST(
      createTestRequest({
        body: {
          email: "user@example.com",
          password: "secret123",
          turnstileToken: "bad-token",
        },
      }),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: "Security check failed. Please try again.",
    })
    expect(passwordRouteMocks.verifyTurnstileTokenMock).toHaveBeenCalledWith({
      remoteip: "203.0.113.9",
      token: "bad-token",
    })
    expect(
      passwordRouteMocks.authenticateWithEmailAndPasswordMock,
    ).not.toHaveBeenCalled()
    expect(passwordRouteMocks.createSessionCookieMock).not.toHaveBeenCalled()
  })

  it("logs in after Turnstile verification and sets the session cookie", async () => {
    const { POST } = await import("../app/api/auth/login/route")
    const response = await POST(
      createTestRequest({
        body: {
          email: " user@example.com ",
          password: "secret123",
          turnstileToken: "turnstile-token",
        },
      }),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      customToken: "custom-token",
      uid: "user-1",
    })
    expect(
      passwordRouteMocks.authenticateWithEmailAndPasswordMock,
    ).toHaveBeenCalledWith({
      email: "user@example.com",
      operation: "login",
      password: "secret123",
    })
    expect(passwordRouteMocks.createSessionCookieMock).toHaveBeenCalledWith(
      "identity-platform-id-token",
    )
    expect(
      passwordRouteMocks.setFirebaseSessionCookieMock,
    ).toHaveBeenCalledWith("session-cookie")
  })

  it("uses the signup operation for account creation", async () => {
    const { POST } = await import("../app/api/auth/signup/route")
    const response = await POST(
      createTestRequest({
        body: {
          email: "new-user@example.com",
          password: "secret123",
          turnstileToken: "signup-turnstile-token",
        },
        url: "https://showseek.test/api/auth/signup",
      }),
    )

    expect(response.status).toBe(200)
    expect(
      passwordRouteMocks.authenticateWithEmailAndPasswordMock,
    ).toHaveBeenCalledWith({
      email: "new-user@example.com",
      operation: "signup",
      password: "secret123",
    })
  })

  it("returns mapped Firebase auth errors without creating a session", async () => {
    passwordRouteMocks.authenticateWithEmailAndPasswordMock.mockRejectedValue(
      new passwordRouteMocks.TestFirebasePasswordAuthError(
        "auth/wrong-password",
        "Invalid email or password. Please check your credentials.",
        401,
      ),
    )

    const { POST } = await import("../app/api/auth/login/route")
    const response = await POST(
      createTestRequest({
        body: {
          email: "user@example.com",
          password: "wrong-password",
          turnstileToken: "turnstile-token",
        },
      }),
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      code: "auth/wrong-password",
      error: "Invalid email or password. Please check your credentials.",
    })
    expect(passwordRouteMocks.createSessionCookieMock).not.toHaveBeenCalled()
    expect(
      passwordRouteMocks.setFirebaseSessionCookieMock,
    ).not.toHaveBeenCalled()
  })

  it("returns a service error if the session cookie cannot be created", async () => {
    passwordRouteMocks.createSessionCookieMock.mockResolvedValue(null)

    const { POST } = await import("../app/api/auth/login/route")
    const response = await POST(
      createTestRequest({
        body: {
          email: "user@example.com",
          password: "secret123",
          turnstileToken: "turnstile-token",
        },
      }),
    )

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      error: "Authentication service temporarily unavailable",
    })
    expect(
      passwordRouteMocks.setFirebaseSessionCookieMock,
    ).not.toHaveBeenCalled()
  })
})
