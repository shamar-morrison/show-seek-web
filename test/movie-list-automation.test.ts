import {
  applyMovieRatingListAutomation,
  applyWatchedMovieListAutomation,
} from "@/lib/movie-list-automation"
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
    it("auto-removes from Should Watch when rating a movie", async () => {
      await applyMovieRatingListAutomation({
        mediaType: "movie",
        movie: {
          movieId: 123,
          title: "Test Movie",
          posterPath: null,
        },
        autoAddToAlreadyWatched: false,
        autoRemoveFromShouldWatch: true,
        addToList: addToListMock,
        removeFromList: removeFromListMock,
      })

      expect(removeFromListMock).toHaveBeenCalledWith("watchlist", "123")
    })

    it("does not auto-remove when the preference is disabled", async () => {
      await applyMovieRatingListAutomation({
        mediaType: "movie",
        movie: {
          movieId: 123,
          title: "Test Movie",
          posterPath: null,
        },
        autoAddToAlreadyWatched: false,
        autoRemoveFromShouldWatch: false,
        addToList: addToListMock,
        removeFromList: removeFromListMock,
      })

      expect(removeFromListMock).not.toHaveBeenCalled()
    })

    it("auto-removes even when there is no warm lists cache", async () => {
      await applyMovieRatingListAutomation({
        mediaType: "movie",
        movie: {
          movieId: 123,
          title: "Test Movie",
          posterPath: null,
        },
        autoAddToAlreadyWatched: false,
        autoRemoveFromShouldWatch: true,
        addToList: addToListMock,
        removeFromList: removeFromListMock,
      })

      expect(removeFromListMock).toHaveBeenCalledWith("watchlist", "123")
    })

    it("auto-removes even when the cache would be stale", async () => {
      await applyMovieRatingListAutomation({
        mediaType: "movie",
        movie: {
          movieId: 123,
          title: "Test Movie",
          posterPath: null,
        },
        autoAddToAlreadyWatched: false,
        autoRemoveFromShouldWatch: true,
        addToList: addToListMock,
        removeFromList: removeFromListMock,
      })

      expect(removeFromListMock).toHaveBeenCalledWith("watchlist", "123")
    })

    it("does not auto-remove when rating TV content", async () => {
      await applyMovieRatingListAutomation({
        mediaType: "tv",
        movie: {
          movieId: 123,
          title: "Test Show",
          posterPath: null,
        },
        autoAddToAlreadyWatched: false,
        autoRemoveFromShouldWatch: true,
        addToList: addToListMock,
        removeFromList: removeFromListMock,
      })

      expect(removeFromListMock).not.toHaveBeenCalled()
    })
  })

  describe("watched flow", () => {
    it("auto-removes from Should Watch when marking a movie as watched", async () => {
      await applyWatchedMovieListAutomation({
        movie: {
          movieId: 123,
          title: "Test Movie",
          posterPath: null,
        },
        isFirstWatch: true,
        autoAddToAlreadyWatched: false,
        autoRemoveFromShouldWatch: true,
        addToList: addToListMock,
        removeFromList: removeFromListMock,
      })

      expect(removeFromListMock).toHaveBeenCalledWith("watchlist", "123")
      expect(toastErrorMock).not.toHaveBeenCalled()
    })

    it("auto-removes when marking watched without a warm lists cache", async () => {
      await applyWatchedMovieListAutomation({
        movie: {
          movieId: 123,
          title: "Test Movie",
          posterPath: null,
        },
        isFirstWatch: true,
        autoAddToAlreadyWatched: false,
        autoRemoveFromShouldWatch: true,
        addToList: addToListMock,
        removeFromList: removeFromListMock,
      })

      expect(removeFromListMock).toHaveBeenCalledWith("watchlist", "123")
    })

    it("auto-removes when marking watched even if the cache would be stale", async () => {
      await applyWatchedMovieListAutomation({
        movie: {
          movieId: 123,
          title: "Test Movie",
          posterPath: null,
        },
        isFirstWatch: true,
        autoAddToAlreadyWatched: false,
        autoRemoveFromShouldWatch: true,
        addToList: addToListMock,
        removeFromList: removeFromListMock,
      })

      expect(removeFromListMock).toHaveBeenCalledWith("watchlist", "123")
    })

    it("keeps the watch flow successful when auto-remove fails", async () => {
      removeFromListMock.mockRejectedValueOnce(new Error("remove failed"))

      await expect(
        applyWatchedMovieListAutomation({
          movie: {
            movieId: 123,
            title: "Test Movie",
            posterPath: null,
          },
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
