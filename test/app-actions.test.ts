import { fetchCollectionsBatch } from "@/app/actions"
import { beforeEach, describe, expect, it, vi } from "vitest"

const getCollectionDetailsMock = vi.fn()

vi.mock("@/lib/tmdb", () => ({
  discoverMedia: vi.fn(),
  getBestTrailer: vi.fn(),
  getCollectionDetails: (...args: unknown[]) =>
    getCollectionDetailsMock(...args),
  getMediaImages: vi.fn(),
  getMediaVideos: vi.fn(),
  getMovieDetails: vi.fn(),
  getRecommendations: vi.fn(),
  getReviews: vi.fn(),
  getSeasonDetails: vi.fn(),
  getTrendingMedia: vi.fn(),
  getTVDetails: vi.fn(),
  multiSearch: vi.fn(),
}))

vi.mock("@/lib/trakt", () => ({
  getTraktMediaComments: vi.fn(),
}))

describe("app actions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("dedupes collection ids, preserves input order, and caps batch concurrency", async () => {
    let activeRequests = 0
    let maxActiveRequests = 0

    getCollectionDetailsMock.mockImplementation(async (collectionId: number) => {
      activeRequests += 1
      maxActiveRequests = Math.max(maxActiveRequests, activeRequests)

      await new Promise((resolve) => setTimeout(resolve, 5))

      activeRequests -= 1

      if (collectionId === 13) {
        throw new Error("Collection fetch failed")
      }

      return {
        id: collectionId,
        name: `Collection ${collectionId}`,
        overview: "",
        poster_path: `/poster-${collectionId}.jpg`,
        backdrop_path: `/backdrop-${collectionId}.jpg`,
        parts: [],
      }
    })

    await expect(
      fetchCollectionsBatch([11, 12, 11, 13, 14, 12]),
    ).resolves.toEqual([
      {
        poster_path: "/poster-11.jpg",
        backdrop_path: "/backdrop-11.jpg",
      },
      {
        poster_path: "/poster-12.jpg",
        backdrop_path: "/backdrop-12.jpg",
      },
      {
        poster_path: "/poster-11.jpg",
        backdrop_path: "/backdrop-11.jpg",
      },
      null,
      {
        poster_path: "/poster-14.jpg",
        backdrop_path: "/backdrop-14.jpg",
      },
      {
        poster_path: "/poster-12.jpg",
        backdrop_path: "/backdrop-12.jpg",
      },
    ])

    expect(getCollectionDetailsMock.mock.calls.map(([id]) => id)).toEqual([
      11, 12, 13, 14,
    ])
    expect(maxActiveRequests).toBeLessThanOrEqual(3)
  })
})
