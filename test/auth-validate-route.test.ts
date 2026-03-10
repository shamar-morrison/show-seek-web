import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("server-only", () => ({}))

const getFirebaseProjectIdMock = vi.fn(() => "showseek-project")

vi.mock("@/lib/firebase/server-api", () => ({
  getFirebaseProjectId: getFirebaseProjectIdMock,
  getFirebaseServiceAccountConfig: vi.fn(() => null),
  getGoogleAccessToken: vi.fn(async () => null),
}))

function createTestRequest(sessionCookie: string): NextRequest {
  return new NextRequest("https://showseek.test/api/auth/validate", {
    body: JSON.stringify({ sessionCookie }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  })
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value).toString("base64url")
}

describe("POST /api/auth/validate", () => {
  beforeEach(() => {
    vi.resetModules()
    getFirebaseProjectIdMock.mockReset()
    getFirebaseProjectIdMock.mockReturnValue("showseek-project")
  })

  it("returns 401 for malformed session cookies", async () => {
    const malformedCookie = `${encodeBase64Url("not-json")}.${encodeBase64Url(
      JSON.stringify({ aud: "showseek-project" }),
    )}.${encodeBase64Url("signature")}`

    const { POST } = await import("../app/api/auth/validate/route")
    const response = await POST(createTestRequest(malformedCookie))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      valid: false,
      status: "invalid",
    })
  })
})
