import { renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { ListMediaItem } from "@/types/list"

const mockUseQueries = vi.fn()
const mockFetchWatchProviders = vi.fn()

vi.mock("@tanstack/react-query", () => ({
  useQueries: (...args: unknown[]) => mockUseQueries(...args),
}))

vi.mock("@/app/actions", () => ({
  fetchWatchProviders: (...args: unknown[]) => mockFetchWatchProviders(...args),
}))

vi.mock("@/lib/react-query/rate-limited-query", () => ({
  createRateLimitedQueryFn: (fn: () => Promise<unknown>) => fn,
}))

function createListItem(overrides: Partial<ListMediaItem>): ListMediaItem {
  return {
    id: 1,
    title: "Item",
    poster_path: null,
    media_type: "movie",
    vote_average: 7,
    release_date: "2024-01-01",
    addedAt: 1,
    ...overrides,
  }
}

describe("useWatchProviderEnrichment", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("deduplicates by media type and id and uses region-aware query keys", async () => {
    let capturedQueries: Array<{
      queryKey: unknown
      queryFn: () => Promise<unknown>
      enabled: boolean
    }> = []

    mockUseQueries.mockImplementation(({ queries }) => {
      capturedQueries = queries
      return queries.map(() => ({
        data: undefined,
        isSuccess: false,
        isError: false,
        isLoading: false,
      }))
    })
    mockFetchWatchProviders.mockResolvedValue(null)

    const { useWatchProviderEnrichment } =
      await import("@/hooks/use-watch-provider-enrichment")

    renderHook(() =>
      useWatchProviderEnrichment(
        [
          createListItem({ id: 10, media_type: "movie" }),
          createListItem({
            id: 10,
            media_type: "movie",
            title: "Duplicate Movie",
          }),
          createListItem({ id: 20, media_type: "tv", name: "Show 20" }),
          createListItem({
            id: 20,
            media_type: "tv",
            name: "Show 20 Again",
          }),
        ],
        "US",
        true,
      ),
    )

    expect(capturedQueries).toHaveLength(2)
    expect(capturedQueries[0].queryKey).toEqual([
      "watch-providers",
      "US",
      "movie",
      10,
    ])
    expect(capturedQueries[1].queryKey).toEqual([
      "watch-providers",
      "US",
      "tv",
      20,
    ])
    expect(capturedQueries[0].enabled).toBe(true)
    expect(capturedQueries[1].enabled).toBe(true)

    await capturedQueries[0].queryFn()
    await capturedQueries[1].queryFn()

    expect(mockFetchWatchProviders).toHaveBeenCalledWith(10, "movie", "US")
    expect(mockFetchWatchProviders).toHaveBeenCalledWith(20, "tv", "US")
  })

  it("maps success and failed provider queries and reports progress", async () => {
    mockUseQueries.mockReturnValue([
      {
        data: { flatrate: [{ provider_id: 8 }] },
        isSuccess: true,
        isError: false,
        isLoading: false,
      },
      {
        data: null,
        isSuccess: true,
        isError: false,
        isLoading: false,
      },
      {
        data: undefined,
        isSuccess: false,
        isError: true,
        isLoading: false,
      },
    ])

    const { useWatchProviderEnrichment } =
      await import("@/hooks/use-watch-provider-enrichment")

    const { result } = renderHook(() =>
      useWatchProviderEnrichment(
        [
          createListItem({ id: 1, media_type: "movie" }),
          createListItem({ id: 2, media_type: "tv" }),
          createListItem({ id: 3, media_type: "movie" }),
        ],
        "US",
        true,
      ),
    )

    expect(result.current.providerMap.get("movie-1")).toEqual({
      flatrate: [{ provider_id: 8 }],
    })
    expect(result.current.providerMap.get("tv-2")).toBeNull()
    expect(result.current.providerMap.get("movie-3")).toBeNull()
    expect(result.current.enrichmentProgress).toBe(1)
    expect(result.current.isLoadingEnrichment).toBe(false)
  })

  it("keeps movie and tv entries separate when ids match", async () => {
    mockUseQueries.mockReturnValue([
      {
        data: { flatrate: [{ provider_id: 8 }] },
        isSuccess: true,
        isError: false,
        isLoading: false,
      },
      {
        data: { flatrate: [{ provider_id: 9 }] },
        isSuccess: true,
        isError: false,
        isLoading: false,
      },
    ])

    const { useWatchProviderEnrichment } =
      await import("@/hooks/use-watch-provider-enrichment")

    const { result } = renderHook(() =>
      useWatchProviderEnrichment(
        [
          createListItem({ id: 100, media_type: "movie" }),
          createListItem({ id: 100, media_type: "tv", name: "Show 100" }),
        ],
        "GB",
        true,
      ),
    )

    expect(result.current.providerMap.get("movie-100")).toEqual({
      flatrate: [{ provider_id: 8 }],
    })
    expect(result.current.providerMap.get("tv-100")).toEqual({
      flatrate: [{ provider_id: 9 }],
    })
    expect(result.current.providerMap.size).toBe(2)
  })

  it("reports loading only while enabled queries are loading", async () => {
    let capturedQueries: Array<{ enabled: boolean }> = []

    mockUseQueries.mockImplementation(({ queries }) => {
      capturedQueries = queries
      return queries.map(() => ({
        data: undefined,
        isSuccess: false,
        isError: false,
        isLoading: true,
      }))
    })

    const { useWatchProviderEnrichment } =
      await import("@/hooks/use-watch-provider-enrichment")

    const { result } = renderHook(() =>
      useWatchProviderEnrichment(
        [
          createListItem({ id: 1, media_type: "movie" }),
          createListItem({ id: 2, media_type: "tv" }),
        ],
        "US",
        false,
      ),
    )

    expect(capturedQueries[0].enabled).toBe(false)
    expect(capturedQueries[1].enabled).toBe(false)
    expect(result.current.isLoadingEnrichment).toBe(false)
    expect(result.current.enrichmentProgress).toBe(0)
  })
})
