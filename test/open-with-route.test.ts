import { beforeEach, describe, expect, it, vi } from "vitest"

const tmdbFetchMock = vi.fn()

vi.mock("@/lib/tmdb", () => ({
  tmdbFetch: tmdbFetchMock,
}))

const traktFetchMock = vi.fn()

function getRequest(url: string): Request {
  return new Request(`https://showseek.test${url}`)
}

describe("GET /api/open-with", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
    vi.stubGlobal("fetch", traktFetchMock)
    tmdbFetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ imdb_id: "tt1375666" }),
    })
    traktFetchMock.mockResolvedValue({
      ok: true,
      json: async () => [{ show: { ids: { slug: "severance" } } }],
    })
  })

  it("returns 400 for invalid params", async () => {
    const { GET } = await import("../app/api/open-with/route")

    const response = await GET(getRequest("/api/open-with?mediaType=tv"))
    expect(response.status).toBe(400)
  })

  it("resolves ids without cached reads", async () => {
    vi.stubEnv("TRAKT_CLIENT_ID", "test-client-id")

    const { GET } = await import("../app/api/open-with/route")
    const response = await GET(
      getRequest("/api/open-with?mediaType=tv&mediaId=456"),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      imdbId: "tt1375666",
      traktSlug: "severance",
    })
    expect(tmdbFetchMock).toHaveBeenCalledWith("/tv/456/external_ids", {
      cache: "no-store",
    })
    expect(traktFetchMock).toHaveBeenCalledWith(
      expect.stringContaining("https://api.trakt.tv/search/tmdb/456"),
      expect.objectContaining({ cache: "no-store" }),
    )
  })

  it("returns nulls when upstream lookups fail", async () => {
    vi.stubEnv("TRAKT_CLIENT_ID", "")
    tmdbFetchMock.mockResolvedValue({ ok: false })

    const { GET } = await import("../app/api/open-with/route")
    const response = await GET(
      getRequest("/api/open-with?mediaType=movie&mediaId=123"),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      imdbId: null,
      traktSlug: null,
    })
  })
})
