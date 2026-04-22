import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

describe("Turnstile verification", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv("TURNSTILE_SECRET_KEY", "turnstile-secret")
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("extracts the Cloudflare client IP before forwarded headers", async () => {
    const { getTurnstileRemoteIp } = await import("../lib/turnstile")
    const headers = new Headers({
      "CF-Connecting-IP": "203.0.113.10",
      "X-Forwarded-For": "198.51.100.1, 198.51.100.2",
    })

    expect(getTurnstileRemoteIp(headers)).toBe("203.0.113.10")
  })

  it("falls back to the first forwarded IP", async () => {
    const { getTurnstileRemoteIp } = await import("../lib/turnstile")
    const headers = new Headers({
      "X-Forwarded-For": "198.51.100.1, 198.51.100.2",
    })

    expect(getTurnstileRemoteIp(headers)).toBe("198.51.100.1")
  })

  it("posts the secret, response, and remote IP to Siteverify", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ success: true }), { status: 200 }),
    )

    vi.stubGlobal("fetch", fetchMock)

    const { verifyTurnstileToken } = await import("../lib/turnstile")

    await expect(
      verifyTurnstileToken({
        token: "turnstile-token",
        remoteip: "203.0.113.10",
      }),
    ).resolves.toBe(true)

    expect(fetchMock).toHaveBeenCalledWith(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      expect.objectContaining({
        body: JSON.stringify({
          secret: "turnstile-secret",
          response: "turnstile-token",
          remoteip: "203.0.113.10",
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      }),
    )
  })

  it("rejects missing tokens without calling Siteverify", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const { verifyTurnstileToken } = await import("../lib/turnstile")

    await expect(
      verifyTurnstileToken({ token: "", remoteip: null }),
    ).resolves.toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("rejects unsuccessful Siteverify responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ success: false }), { status: 200 }),
      ),
    )

    const { verifyTurnstileToken } = await import("../lib/turnstile")

    await expect(
      verifyTurnstileToken({
        token: "turnstile-token",
        remoteip: "203.0.113.10",
      }),
    ).resolves.toBe(false)
  })

  it("rejects verification when the secret is not configured", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "")
    vi.stubGlobal("fetch", vi.fn())
    vi.spyOn(console, "error").mockImplementation(() => {})

    const { verifyTurnstileToken } = await import("../lib/turnstile")

    await expect(
      verifyTurnstileToken({
        token: "turnstile-token",
        remoteip: "203.0.113.10",
      }),
    ).resolves.toBe(false)
    expect(fetch).not.toHaveBeenCalled()
  })
})
