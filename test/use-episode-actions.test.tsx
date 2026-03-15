import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { useEpisodeActions } from "@/hooks/use-episode-actions"

const toastErrorMock = vi.fn()
const toastSuccessMock = vi.fn()

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastErrorMock(...args),
    success: (...args: unknown[]) => toastSuccessMock(...args),
  },
}))

function createEpisode() {
  return {
    episode_number: 2,
    name: "Half Loop",
    season_number: 1,
  }
}

function createOptions(
  overrides: Partial<Parameters<typeof useEpisodeActions>[0]> = {},
) {
  return {
    episode: createEpisode(),
    favoriteActionLoading: false,
    isFavorited: false,
    openNotes: vi.fn(),
    requireAuth: vi.fn((callback?: () => void | Promise<void>) => callback?.()),
    toggleEpisode: vi.fn().mockResolvedValue(undefined),
    tvShowId: 100,
    tvShowName: "Signal Run",
    tvShowPosterPath: "/poster.jpg",
    ...overrides,
  }
}

describe("useEpisodeActions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("routes favorite clicks through auth guard with the favorite message", () => {
    const options = createOptions({
      requireAuth: vi.fn(),
    })
    const { result } = renderHook(() => useEpisodeActions(options))

    act(() => {
      result.current.handleFavoriteClick()
    })

    expect(options.requireAuth).toHaveBeenCalledTimes(1)
    expect(options.requireAuth).toHaveBeenCalledWith(
      expect.any(Function),
      "Sign in to favorite episodes",
    )
  })

  it("uses the favorite payload helper shape and shows a success toast", async () => {
    const options = createOptions()
    const { result } = renderHook(() => useEpisodeActions(options))

    await act(async () => {
      result.current.handleFavoriteClick()
      await Promise.resolve()
    })

    expect(options.toggleEpisode).toHaveBeenCalledWith({
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
    expect(toastSuccessMock).toHaveBeenCalledWith(
      "Added to favorite episodes",
      expect.objectContaining({
        action: expect.objectContaining({
          label: "Undo",
          onClick: expect.any(Function),
        }),
      }),
    )
  })

  it("wires undo on the success toast to the inverse toggle", async () => {
    const options = createOptions()
    const { result } = renderHook(() => useEpisodeActions(options))

    await act(async () => {
      result.current.handleFavoriteClick()
      await Promise.resolve()
    })

    const toastAction = toastSuccessMock.mock.calls[0]?.[1] as
      | { action?: { onClick: () => void } }
      | undefined

    await act(async () => {
      toastAction?.action?.onClick()
      await Promise.resolve()
    })

    expect(options.toggleEpisode).toHaveBeenNthCalledWith(2, {
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
  })

  it("logs and shows an error toast when favorite toggling fails", async () => {
    const expectedError = new Error("toggle failed")
    const options = createOptions({
      toggleEpisode: vi.fn().mockRejectedValue(expectedError),
    })
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const { result } = renderHook(() => useEpisodeActions(options))

    await act(async () => {
      result.current.handleFavoriteClick()
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to toggle favorite episode:",
        expectedError,
      )
    })
    expect(toastErrorMock).toHaveBeenCalledWith(
      "Failed to add to favorite episodes",
    )
  })

  it("opens notes through auth guard with the notes message", async () => {
    const options = createOptions()
    const { result } = renderHook(() => useEpisodeActions(options))

    act(() => {
      result.current.openNotesModal()
    })

    expect(options.requireAuth).toHaveBeenCalledWith(
      expect.any(Function),
      "Sign in to add personal notes",
    )
    await waitFor(() => {
      expect(options.openNotes).toHaveBeenCalledTimes(1)
    })
  })

  it("short-circuits favorite toggles while loading", async () => {
    const options = createOptions({
      favoriteActionLoading: true,
    })
    const { result } = renderHook(() => useEpisodeActions(options))

    expect(result.current.favoriteActionLoading).toBe(true)

    await act(async () => {
      await result.current.handleToggleFavorite()
    })

    expect(options.toggleEpisode).not.toHaveBeenCalled()
  })
})
