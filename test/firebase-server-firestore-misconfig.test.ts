import { beforeEach, describe, expect, it, vi } from "vitest"

const getFirebaseServiceAccountConfigMock = vi.fn()
const getGoogleAccessTokenMock = vi.fn()

vi.mock("@/lib/firebase/server-api", () => ({
  getFirebaseServiceAccountConfig: getFirebaseServiceAccountConfigMock,
  getGoogleAccessToken: getGoogleAccessTokenMock,
}))

describe("firebase server firestore misconfiguration", () => {
  beforeEach(() => {
    vi.resetModules()
    getFirebaseServiceAccountConfigMock.mockReset()
    getGoogleAccessTokenMock.mockReset()
    getFirebaseServiceAccountConfigMock.mockReturnValue({
      clientEmail: "service-account@example.com",
      privateKey: "private-key",
      projectId: "showseek-project",
    })
    getGoogleAccessTokenMock.mockResolvedValue("google-access-token")
  })

  it("throws when Firebase service account configuration is missing", async () => {
    getFirebaseServiceAccountConfigMock.mockReturnValue(null)

    const { getUserPremiumStatus } = await import(
      "../lib/firebase/server-firestore"
    )

    await expect(getUserPremiumStatus("user-1")).rejects.toThrow(
      "Missing Firebase service account configuration",
    )
  })

  it("throws when the Google access token is unavailable", async () => {
    getGoogleAccessTokenMock.mockResolvedValue(null)

    const { countCustomLists } = await import("../lib/firebase/server-firestore")

    await expect(countCustomLists("user-1")).rejects.toThrow(
      "Missing Google access token for Firestore server access",
    )
  })
})
