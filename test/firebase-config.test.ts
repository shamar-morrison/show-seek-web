import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const REQUIRED_FIREBASE_ENV_KEYS = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
] as const

function clearFirebaseClientEnv() {
  for (const key of REQUIRED_FIREBASE_ENV_KEYS) {
    vi.stubEnv(key, "")
  }
}

describe("firebase config", () => {
  beforeEach(() => {
    vi.resetModules()
    clearFirebaseClientEnv()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it("can be imported without throwing when client config is missing", async () => {
    await expect(import("../lib/firebase/config")).resolves.toBeDefined()
  })

  it("reports missing Firebase client configuration", async () => {
    const config = await import("../lib/firebase/config")

    expect(config.isFirebaseClientConfigured).toBe(false)
    expect(config.getMissingFirebaseClientConfigKeys()).toEqual(
      REQUIRED_FIREBASE_ENV_KEYS,
    )
  })

  it("throws a clear error when Firebase getters are called without config", async () => {
    const config = await import("../lib/firebase/config")

    expect(() => config.getFirebaseAuth()).toThrowError(
      /Firebase client configuration is missing:/,
    )
    expect(() => config.getFirebaseDb()).toThrowError(
      /NEXT_PUBLIC_FIREBASE_API_KEY/,
    )
    expect(() => config.getFirebaseFunctions()).toThrowError(
      /NEXT_PUBLIC_FIREBASE_APP_ID/,
    )

    try {
      config.getFirebaseAuth()
    } catch (error) {
      expect(error).toMatchObject({
        code: config.FIREBASE_CLIENT_CONFIG_ERROR_CODE,
      })
    }
  })
})
