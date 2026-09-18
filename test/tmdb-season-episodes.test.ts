import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const fetchMock = vi.fn()
const originalFetch = global.fetch

describe("fetchSeasonEpisodes server action", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv("TMDB_BEARER_TOKEN", "test-token")
    fetchMock.mockReset()
    global.fetch = fetchMock as unknown as typeof fetch
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    global.fetch = originalFetch
  })

  it("returns the season episodes on success", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 1,
        season_number: 1,
        name: "Season 1",
        overview: "",
        poster_path: null,
        air_date: "2020-01-01",
        vote_average: 8,
        episodes: [
          {
            id: 11,
            episode_number: 1,
            name: "Pilot",
            overview: "",
            air_date: "2020-01-01",
            runtime: 42,
            still_path: null,
            vote_average: 7,
            vote_count: 1,
            season_number: 1,
          },
        ],
      }),
    })

    const { fetchSeasonEpisodes } = await import("@/app/server-actions/tmdb")
    const episodes = await fetchSeasonEpisodes(99, 1)

    expect(episodes).toHaveLength(1)
    expect(episodes[0]).toMatchObject({
      id: 11,
      episode_number: 1,
      name: "Pilot",
      air_date: "2020-01-01",
    })
  })

  it("returns an empty array for a season that legitimately has no episodes", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 1,
        season_number: 1,
        name: "Season 1",
        overview: "",
        poster_path: null,
        air_date: null,
        vote_average: 0,
        episodes: [],
      }),
    })

    const { fetchSeasonEpisodes } = await import("@/app/server-actions/tmdb")

    await expect(fetchSeasonEpisodes(99, 1)).resolves.toEqual([])
  })

  it("throws instead of returning an empty array when the season fetch fails", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 })

    const { fetchSeasonEpisodes } = await import("@/app/server-actions/tmdb")

    await expect(fetchSeasonEpisodes(99, 1)).rejects.toThrow(
      /Failed to load season 1/,
    )
  })
})
