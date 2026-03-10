import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void

  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve
  })

  return {
    promise,
    resolve,
  }
}

function createAccessTokenResponse(
  accessToken: string,
  expiresIn = 3600,
): Response {
  return new Response(
    JSON.stringify({
      access_token: accessToken,
      expires_in: expiresIn,
    }),
    { status: 200 },
  )
}

async function waitForAssertion(assertion: () => void): Promise<void> {
  let lastError: unknown

  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      assertion()
      return
    } catch (error) {
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
  }

  throw lastError
}

describe("firebase server api", () => {
  const originalEnv = {
    FIREBASE_ADMIN_CLIENT_EMAIL: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    FIREBASE_ADMIN_PRIVATE_KEY: process.env.FIREBASE_ADMIN_PRIVATE_KEY,
    FIREBASE_ADMIN_PROJECT_ID: process.env.FIREBASE_ADMIN_PROJECT_ID,
  }

  beforeEach(() => {
    vi.resetModules()

    process.env.FIREBASE_ADMIN_PROJECT_ID = "showseek-project"
    process.env.FIREBASE_ADMIN_CLIENT_EMAIL = "service-account@example.com"
    process.env.FIREBASE_ADMIN_PRIVATE_KEY = [
      "-----BEGIN PRIVATE KEY-----",
      Buffer.from("test-private-key").toString("base64"),
      "-----END PRIVATE KEY-----",
    ].join("\n")
  })

  afterEach(() => {
    if (originalEnv.FIREBASE_ADMIN_PROJECT_ID === undefined) {
      Reflect.deleteProperty(process.env, "FIREBASE_ADMIN_PROJECT_ID")
    } else {
      process.env.FIREBASE_ADMIN_PROJECT_ID = originalEnv.FIREBASE_ADMIN_PROJECT_ID
    }

    if (originalEnv.FIREBASE_ADMIN_CLIENT_EMAIL === undefined) {
      Reflect.deleteProperty(process.env, "FIREBASE_ADMIN_CLIENT_EMAIL")
    } else {
      process.env.FIREBASE_ADMIN_CLIENT_EMAIL =
        originalEnv.FIREBASE_ADMIN_CLIENT_EMAIL
    }

    if (originalEnv.FIREBASE_ADMIN_PRIVATE_KEY === undefined) {
      Reflect.deleteProperty(process.env, "FIREBASE_ADMIN_PRIVATE_KEY")
    } else {
      process.env.FIREBASE_ADMIN_PRIVATE_KEY = originalEnv.FIREBASE_ADMIN_PRIVATE_KEY
    }

    vi.unstubAllGlobals()
  })

  it("shares a single in-flight access token refresh across concurrent callers", async () => {
    const fetchDeferred = createDeferred<Response>()
    const fetchMock = vi.fn(async () => fetchDeferred.promise)
    const importKeyMock = vi.fn(async () => ({} as CryptoKey))
    const signMock = vi.fn(async () => new Uint8Array([1, 2, 3]).buffer)

    vi.stubGlobal("fetch", fetchMock)
    vi.stubGlobal("crypto", {
      subtle: {
        importKey: importKeyMock,
        sign: signMock,
      },
    })

    const { getGoogleAccessToken } = await import("../lib/firebase/server-api")

    const tokenPromiseA = getGoogleAccessToken()
    const tokenPromiseB = getGoogleAccessToken()

    await waitForAssertion(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })
    const [firstFetchCall] = fetchMock.mock.calls as unknown as Array<
      [string, RequestInit | undefined]
    >
    const fetchOptions = firstFetchCall?.[1]

    expect(fetchOptions).toEqual(
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    )

    fetchDeferred.resolve(createAccessTokenResponse("shared-token"))

    await expect(
      Promise.all([tokenPromiseA, tokenPromiseB]),
    ).resolves.toEqual(["shared-token", "shared-token"])
    expect(importKeyMock).toHaveBeenCalledTimes(1)
    expect(signMock).toHaveBeenCalledTimes(1)
  })

  it("clears a failed in-flight token refresh so a later attempt can retry", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("backend unavailable", { status: 500 }),
      )
      .mockResolvedValueOnce(createAccessTokenResponse("retried-token"))

    vi.stubGlobal("fetch", fetchMock)
    vi.stubGlobal("crypto", {
      subtle: {
        importKey: vi.fn(async () => ({} as CryptoKey)),
        sign: vi.fn(async () => new Uint8Array([1, 2, 3]).buffer),
      },
    })

    const { getGoogleAccessToken } = await import("../lib/firebase/server-api")

    const firstAttempt = await Promise.allSettled([
      getGoogleAccessToken(),
      getGoogleAccessToken(),
    ])

    expect(firstAttempt).toEqual([
      expect.objectContaining({
        reason: expect.any(Error),
        status: "rejected",
      }),
      expect.objectContaining({
        reason: expect.any(Error),
        status: "rejected",
      }),
    ])
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await expect(getGoogleAccessToken()).resolves.toBe("retried-token")
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("evicts rejected signing key imports so later attempts can recover", async () => {
    const importKeyMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("import failed"))
      .mockResolvedValueOnce({} as CryptoKey)
    const fetchMock = vi.fn(async () => createAccessTokenResponse("token"))

    vi.stubGlobal("fetch", fetchMock)
    vi.stubGlobal("crypto", {
      subtle: {
        importKey: importKeyMock,
        sign: vi.fn(async () => new Uint8Array([1, 2, 3]).buffer),
      },
    })

    const { getGoogleAccessToken } = await import("../lib/firebase/server-api")

    await expect(getGoogleAccessToken()).rejects.toThrow("import failed")
    await expect(getGoogleAccessToken()).resolves.toBe("token")
    expect(importKeyMock).toHaveBeenCalledTimes(2)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
