import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

function createRequest({
  body,
  headers,
  method = "GET",
  url = "https://showseek.test/api/trakt/sync",
}: {
  body?: Record<string, unknown>
  headers?: HeadersInit
  method?: string
  url?: string
} = {}): NextRequest {
  return new NextRequest(url, {
    body: body ? JSON.stringify(body) : undefined,
    headers,
    method,
  })
}

describe("Trakt proxy routes", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
    vi.stubGlobal("fetch", vi.fn())
  })

  it("rejects requests without a Firebase bearer token", async () => {
    const { POST } = await import("../app/api/trakt/oauth/start/route")
    const response = await POST(createRequest({ method: "POST" }))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" })
    expect(fetch).not.toHaveBeenCalled()
  })

  it("derives the deployed Firebase Functions URL when no override is set", async () => {
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID", "showseek-app-2025")
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ status: "queued" }), {
        headers: { "content-type": "application/json" },
        status: 202,
      }),
    )

    const { POST } = await import("../app/api/trakt/sync/route")
    const response = await POST(
      createRequest({
        body: { force: true },
        headers: {
          Authorization: "Bearer firebase-id-token",
          "Content-Type": "application/json",
        },
        method: "POST",
      }),
    )

    expect(response.status).toBe(202)
    await expect(response.json()).resolves.toEqual({ status: "queued" })
    expect(fetch).toHaveBeenCalledWith(
      "https://us-central1-showseek-app-2025.cloudfunctions.net/traktApi/sync",
      expect.objectContaining({
        body: JSON.stringify({ force: true }),
        cache: "no-store",
        headers: {
          Authorization: "Bearer firebase-id-token",
          "Content-Type": "application/json",
        },
        method: "POST",
      }),
    )
  })

  it("uses the configured backend URL and forwards GET requests", async () => {
    vi.stubEnv("TRAKT_BACKEND_URL", "https://functions.example/traktApi/")
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ status: "completed" }), {
        headers: { "content-type": "application/json" },
      }),
    )

    const { GET } = await import("../app/api/trakt/enrich/route")
    const response = await GET(
      createRequest({
        headers: { Authorization: "Bearer firebase-id-token" },
        url: "https://showseek.test/api/trakt/enrich",
      }),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ status: "completed" })
    expect(fetch).toHaveBeenCalledWith(
      "https://functions.example/traktApi/enrich",
      expect.objectContaining({
        body: undefined,
        headers: { Authorization: "Bearer firebase-id-token" },
        method: "GET",
      }),
    )
  })

  it("normalizes empty request bodies to undefined", async () => {
    vi.stubEnv("TRAKT_BACKEND_URL", "https://functions.example/traktApi")
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }))

    const { POST } = await import("../app/api/trakt/disconnect/route")
    const response = await POST(
      new NextRequest("https://showseek.test/api/trakt/disconnect", {
        body: "",
        headers: {
          Authorization: "Bearer firebase-id-token",
          "Content-Type": "application/json",
        },
        method: "POST",
      }),
    )

    expect(response.status).toBe(204)
    expect(fetch).toHaveBeenCalledWith(
      "https://functions.example/traktApi/disconnect",
      expect.objectContaining({
        body: undefined,
        headers: { Authorization: "Bearer firebase-id-token" },
        method: "POST",
      }),
    )
  })

  it("passes backend errors through to the client", async () => {
    vi.stubEnv("TRAKT_BACKEND_URL", "https://functions.example/traktApi")
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          errorCategory: "rate_limited",
          errorMessage: "Try again later",
          nextAllowedSyncAt: "2026-04-25T00:00:00.000Z",
        }),
        {
          headers: { "content-type": "application/json" },
          status: 429,
        },
      ),
    )

    const { POST } = await import("../app/api/trakt/sync/route")
    const response = await POST(
      createRequest({
        headers: { Authorization: "Bearer firebase-id-token" },
        method: "POST",
      }),
    )

    expect(response.status).toBe(429)
    await expect(response.json()).resolves.toEqual({
      errorCategory: "rate_limited",
      errorMessage: "Try again later",
      nextAllowedSyncAt: "2026-04-25T00:00:00.000Z",
    })
  })

  it("reports missing backend configuration", async () => {
    const { GET } = await import("../app/api/trakt/sync/route")
    const response = await GET(
      createRequest({
        headers: { Authorization: "Bearer firebase-id-token" },
      }),
    )

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      error: "Trakt backend is not configured",
    })
    expect(fetch).not.toHaveBeenCalled()
  })
})
