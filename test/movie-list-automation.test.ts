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

    it("forwards original_title when auto-adding a rated movie", async () => {
      addToListMock.mockResolvedValueOnce(true)

      await applyMovieRatingListAutomation({
        mediaType: "movie",
        movie: {
          movieId: 123,
          title: "Spirited Away",
          originalTitle: "Sen to Chihiro no Kamikakushi",
          posterPath: null,
        },
        autoAddToAlreadyWatched: true,
        autoRemoveFromShouldWatch: false,
        addToList: addToListMock,
        removeFromList: removeFromListMock,
      })

      expect(addToListMock).toHaveBeenCalledWith(
        "already-watched",
        expect.objectContaining({
          original_title: "Sen to Chihiro no Kamikakushi",
        }),
      )
      expect(toastSuccessMock).toHaveBeenCalledWith(
        "Added to Already Watched list",
        expect.objectContaining({
          action: expect.objectContaining({
            label: "Undo",
            onClick: expect.any(Function),
          }),
        }),
      )
    })

    it("undoes auto-add to Already Watched from the success toast action", async () => {
      addToListMock.mockResolvedValueOnce(true)

      await applyMovieRatingListAutomation({
        mediaType: "movie",
        movie: {
          movieId: 123,
          title: "Spirited Away",
          originalTitle: "Sen to Chihiro no Kamikakushi",
          posterPath: null,
        },
        autoAddToAlreadyWatched: true,
        autoRemoveFromShouldWatch: false,
        addToList: addToListMock,
        removeFromList: removeFromListMock,
      })

      const toastOptions = toastSuccessMock.mock.calls[0]?.[1] as
        | { action?: { onClick: () => void } }
        | undefined

      toastOptions?.action?.onClick()

      expect(removeFromListMock).toHaveBeenCalledWith("already-watched", "123")
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

    it("forwards original_title when auto-adding a watched movie", async () => {
      await applyWatchedMovieListAutomation({
        movie: {
          movieId: 123,
          title: "Spirited Away",
          originalTitle: "Sen to Chihiro no Kamikakushi",
          posterPath: null,
        },
        isFirstWatch: true,
        autoAddToAlreadyWatched: true,
        autoRemoveFromShouldWatch: false,
        addToList: addToListMock,
        removeFromList: removeFromListMock,
      })

      expect(addToListMock).toHaveBeenCalledWith(
        "already-watched",
        expect.objectContaining({
          original_title: "Sen to Chihiro no Kamikakushi",
        }),
      )
    })
  })
})
