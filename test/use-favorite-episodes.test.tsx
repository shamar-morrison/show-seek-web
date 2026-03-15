import {
  useFavoriteEpisodes,
  useIsEpisodeFavorited,
  useToggleFavoriteEpisode,
} from "@/hooks/use-favorite-episodes"
import { queryKeys } from "@/lib/react-query/query-keys"
import type { FavoriteEpisode } from "@/types/favorite-episode"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const addFavoriteEpisodeMock = vi.fn()
const fetchFavoriteEpisodesMock = vi.fn()
const removeFavoriteEpisodeMock = vi.fn()

vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({
    user: {
      uid: "user-1",
      isAnonymous: false,
    },
    loading: false,
  }),
}))

vi.mock("@/lib/firebase/favorite-episodes", () => ({
  addFavoriteEpisode: (...args: unknown[]) => addFavoriteEpisodeMock(...args),
  fetchFavoriteEpisodes: (...args: unknown[]) =>
    fetchFavoriteEpisodesMock(...args),
  removeFavoriteEpisode: (...args: unknown[]) =>
    removeFavoriteEpisodeMock(...args),
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return {
    queryClient,
    Wrapper({ children }: { children: ReactNode }) {
      return (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      )
    },
  }
}

function createDeferredPromise<T>() {
  let resolve!: (value: T) => void

  const promise = new Promise<T>((res) => {
    resolve = res
  })

  return { promise, resolve }
}

function createFavoriteEpisode(
  overrides: Partial<FavoriteEpisode> = {},
): FavoriteEpisode {
  return {
    id: "100-1-2",
    tvShowId: 100,
    seasonNumber: 1,
    episodeNumber: 2,
    episodeName: "Half Loop",
    showName: "Signal Run",
    posterPath: "/poster.jpg",
    addedAt: 123,
    ...overrides,
  }
}

function useFavoriteEpisodesHarness() {
  const favoriteEpisodes = useFavoriteEpisodes()
  const favoriteStatus = useIsEpisodeFavorited(100, 1, 2)
  const toggle = useToggleFavoriteEpisode()

  return {
    ...favoriteEpisodes,
    ...favoriteStatus,
    ...toggle,
  }
}

describe("useFavoriteEpisodes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchFavoriteEpisodesMock.mockResolvedValue([])
    addFavoriteEpisodeMock.mockResolvedValue(undefined)
    removeFavoriteEpisodeMock.mockResolvedValue(undefined)
  })

  it("optimistically adds favorite episodes and updates derived favorite state", async () => {
    const { queryClient, Wrapper } = createWrapper()
    const addDeferred = createDeferredPromise<void>()

    addFavoriteEpisodeMock.mockImplementationOnce(() => addDeferred.promise)

    const { result } = renderHook(() => useFavoriteEpisodesHarness(), {
      wrapper: Wrapper,
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    let togglePromise!: Promise<void>

    await act(async () => {
      togglePromise = result.current.toggleEpisode({
        isFavorited: false,
        episode: {
          id: "100-1-2",
          tvShowId: 100,
          seasonNumber: 1,
          episodeNumber: 2,
          episodeName: "Half Loop",
          showName: "Signal Run",
          posterPath: "/poster.jpg",
        },
      })
      await Promise.resolve()
    })

    expect(addFavoriteEpisodeMock).toHaveBeenCalledWith("user-1", {
      id: "100-1-2",
      tvShowId: 100,
      seasonNumber: 1,
      episodeNumber: 2,
      episodeName: "Half Loop",
      showName: "Signal Run",
      posterPath: "/poster.jpg",
    })

    await waitFor(() => {
      const episodes = queryClient.getQueryData<FavoriteEpisode[]>(
        queryKeys.firestore.favoriteEpisodes("user-1"),
      )

      expect(episodes).toHaveLength(1)
      expect(episodes?.[0]?.id).toBe("100-1-2")
      expect(result.current.isFavorited).toBe(true)
    })

    fetchFavoriteEpisodesMock.mockResolvedValue([createFavoriteEpisode()])
    addDeferred.resolve(undefined)

    await act(async () => {
      await togglePromise
    })
  })

  it("optimistically removes favorite episodes and clears derived favorite state", async () => {
    const { queryClient, Wrapper } = createWrapper()
    const removeDeferred = createDeferredPromise<void>()

    fetchFavoriteEpisodesMock.mockResolvedValue([createFavoriteEpisode()])
    removeFavoriteEpisodeMock.mockImplementationOnce(() => removeDeferred.promise)

    const { result } = renderHook(() => useFavoriteEpisodesHarness(), {
      wrapper: Wrapper,
    })

    await waitFor(() => {
      expect(result.current.isFavorited).toBe(true)
    })

    let togglePromise!: Promise<void>

    await act(async () => {
      togglePromise = result.current.toggleEpisode({
        isFavorited: true,
        episode: {
          id: "100-1-2",
          tvShowId: 100,
          seasonNumber: 1,
          episodeNumber: 2,
          episodeName: "Half Loop",
          showName: "Signal Run",
          posterPath: "/poster.jpg",
        },
      })
      await Promise.resolve()
    })

    expect(removeFavoriteEpisodeMock).toHaveBeenCalledWith("user-1", "100-1-2")

    await waitFor(() => {
      const episodes = queryClient.getQueryData<FavoriteEpisode[]>(
        queryKeys.firestore.favoriteEpisodes("user-1"),
      )

      expect(episodes).toHaveLength(0)
      expect(result.current.isFavorited).toBe(false)
    })

    fetchFavoriteEpisodesMock.mockResolvedValue([])
    removeDeferred.resolve(undefined)

    await act(async () => {
      await togglePromise
    })
  })
})
