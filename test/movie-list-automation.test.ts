import {
  applyMovieRatingListAutomation,
  applyWatchedMovieListAutomation,
} from "@/lib/movie-list-automation"
import { queryKeys } from "@/lib/react-query/query-keys"
import type { UserList } from "@/types/list"
import { QueryClient } from "@tanstack/react-query"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const addToListMock = vi.fn()
const removeFromListMock = vi.fn()
const toastErrorMock = vi.fn()
const toastSuccessMock = vi.fn()
let consoleErrorSpy: ReturnType<typeof vi.spyOn>

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastErrorMock(...args),
    success: (...args: unknown[]) => toastSuccessMock(...args),
  },
}))

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
}

function createWatchlist(listItemId: number): UserList {
  return {
    id: "watchlist",
    name: "Should Watch",
    items: {
      [String(listItemId)]: {
        id: listItemId,
        title: "Test Movie",
        poster_path: null,
        media_type: "movie",
        addedAt: Date.now(),
      },
    },
    createdAt: Date.now(),
    isCustom: false,
  }
}

describe("movie list automation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    addToListMock.mockResolvedValue(false)
    removeFromListMock.mockResolvedValue(undefined)
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  describe("rating flow", () => {
    it("auto-removes from Should Watch when rating a cached movie in the watchlist", async () => {
      const queryClient = createQueryClient()
      queryClient.setQueryData(queryKeys.firestore.lists("user-1"), [
        createWatchlist(123),
      ])

      await applyMovieRatingListAutomation({
        mediaType: "movie",
        movie: {
          movieId: 123,
          title: "Test Movie",
          posterPath: null,
        },
        queryClient,
        userId: "user-1",
        autoAddToAlreadyWatched: false,
        autoRemoveFromShouldWatch: true,
        addToList: addToListMock,
        removeFromList: removeFromListMock,
      })

      expect(removeFromListMock).toHaveBeenCalledWith("watchlist", "123")
    })

    it("does not auto-remove when the preference is disabled", async () => {
      const queryClient = createQueryClient()
      queryClient.setQueryData(queryKeys.firestore.lists("user-1"), [
        createWatchlist(123),
      ])

      await applyMovieRatingListAutomation({
        mediaType: "movie",
        movie: {
          movieId: 123,
          title: "Test Movie",
          posterPath: null,
        },
        queryClient,
        userId: "user-1",
        autoAddToAlreadyWatched: false,
        autoRemoveFromShouldWatch: false,
        addToList: addToListMock,
        removeFromList: removeFromListMock,
      })

      expect(removeFromListMock).not.toHaveBeenCalled()
    })

    it("does not auto-remove when the lists cache is missing", async () => {
      const queryClient = createQueryClient()

      await applyMovieRatingListAutomation({
        mediaType: "movie",
        movie: {
          movieId: 123,
          title: "Test Movie",
          posterPath: null,
        },
        queryClient,
        userId: "user-1",
        autoAddToAlreadyWatched: false,
        autoRemoveFromShouldWatch: true,
        addToList: addToListMock,
        removeFromList: removeFromListMock,
      })

      expect(removeFromListMock).not.toHaveBeenCalled()
    })

    it("does not auto-remove when the movie is not in the cached watchlist", async () => {
      const queryClient = createQueryClient()
      queryClient.setQueryData(queryKeys.firestore.lists("user-1"), [
        createWatchlist(999),
      ])

      await applyMovieRatingListAutomation({
        mediaType: "movie",
        movie: {
          movieId: 123,
          title: "Test Movie",
          posterPath: null,
        },
        queryClient,
        userId: "user-1",
        autoAddToAlreadyWatched: false,
        autoRemoveFromShouldWatch: true,
        addToList: addToListMock,
        removeFromList: removeFromListMock,
      })

      expect(removeFromListMock).not.toHaveBeenCalled()
    })

    it("does not auto-remove when rating TV content", async () => {
      const queryClient = createQueryClient()
      queryClient.setQueryData(queryKeys.firestore.lists("user-1"), [
        createWatchlist(123),
      ])

      await applyMovieRatingListAutomation({
        mediaType: "tv",
        movie: {
          movieId: 123,
          title: "Test Show",
          posterPath: null,
        },
        queryClient,
        userId: "user-1",
        autoAddToAlreadyWatched: false,
        autoRemoveFromShouldWatch: true,
        addToList: addToListMock,
        removeFromList: removeFromListMock,
      })

      expect(removeFromListMock).not.toHaveBeenCalled()
    })
  })

  describe("watched flow", () => {
    it("auto-removes from Should Watch when marking a cached movie as watched", async () => {
      const queryClient = createQueryClient()
      queryClient.setQueryData(queryKeys.firestore.lists("user-1"), [
        createWatchlist(123),
      ])

      await applyWatchedMovieListAutomation({
        movie: {
          movieId: 123,
          title: "Test Movie",
          posterPath: null,
        },
        queryClient,
        userId: "user-1",
        isFirstWatch: true,
        autoAddToAlreadyWatched: false,
        autoRemoveFromShouldWatch: true,
        addToList: addToListMock,
        removeFromList: removeFromListMock,
      })

      expect(removeFromListMock).toHaveBeenCalledWith("watchlist", "123")
      expect(toastErrorMock).not.toHaveBeenCalled()
    })

    it("does not auto-remove when the lists cache is missing", async () => {
      const queryClient = createQueryClient()

      await applyWatchedMovieListAutomation({
        movie: {
          movieId: 123,
          title: "Test Movie",
          posterPath: null,
        },
        queryClient,
        userId: "user-1",
        isFirstWatch: true,
        autoAddToAlreadyWatched: false,
        autoRemoveFromShouldWatch: true,
        addToList: addToListMock,
        removeFromList: removeFromListMock,
      })

      expect(removeFromListMock).not.toHaveBeenCalled()
    })

    it("keeps the watch flow successful when auto-remove fails", async () => {
      removeFromListMock.mockRejectedValueOnce(new Error("remove failed"))

      const queryClient = createQueryClient()
      queryClient.setQueryData(queryKeys.firestore.lists("user-1"), [
        createWatchlist(123),
      ])

      await expect(
        applyWatchedMovieListAutomation({
          movie: {
            movieId: 123,
            title: "Test Movie",
            posterPath: null,
          },
          queryClient,
          userId: "user-1",
          isFirstWatch: true,
          autoAddToAlreadyWatched: false,
          autoRemoveFromShouldWatch: true,
          addToList: addToListMock,
          removeFromList: removeFromListMock,
        }),
      ).resolves.toBeUndefined()

      expect(removeFromListMock).toHaveBeenCalledWith("watchlist", "123")
      expect(toastErrorMock).not.toHaveBeenCalled()
    })
  })
})
