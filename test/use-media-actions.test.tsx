import { render } from "@/test/utils"
import { useMediaActions } from "@/hooks/use-media-actions"
import type { UserList } from "@/types/list"
import type { TMDBMedia } from "@/types/tmdb"
import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  addWatchInstance: vi.fn(),
  clearAllWatches: vi.fn(),
  closeModal: vi.fn(),
  deleteWatchInstance: vi.fn(),
  getNote: vi.fn(),
  getRating: vi.fn(),
  instances: [] as Array<{ id: string; movieId: number; watchedAt: Date }>,
  isLoading: false,
  lists: [] as UserList[],
  preferences: {
    showListIndicators: false,
    quickMarkAsWatched: false,
    autoAddToAlreadyWatched: false,
    autoRemoveFromShouldWatch: false,
  },
  requireAuth: vi.fn((callback?: () => void) => callback?.()),
  updateWatchInstance: vi.fn(),
  useWatchedMovies: vi.fn(),
}))

vi.mock("next/dynamic", () => ({
  default: () => () => null,
}))

vi.mock("@/hooks/use-auth-guard", () => ({
  useAuthGuard: () => ({
    requireAuth: mocks.requireAuth,
    modalVisible: false,
    modalMessage: "",
    closeModal: mocks.closeModal,
  }),
}))

vi.mock("@/hooks/use-lists", () => ({
  useLists: () => ({
    lists: mocks.lists,
    loading: false,
    error: null,
  }),
}))

vi.mock("@/hooks/use-notes", () => ({
  useNotes: () => ({
    getNote: mocks.getNote,
  }),
}))

vi.mock("@/hooks/use-preferences", () => ({
  usePreferences: () => ({
    preferences: mocks.preferences,
  }),
}))

vi.mock("@/hooks/use-ratings", () => ({
  useRatings: () => ({
    getRating: mocks.getRating,
  }),
}))

vi.mock("@/hooks/use-watched-movies", () => ({
  useWatchedMovies: (...args: unknown[]) => mocks.useWatchedMovies(...args),
}))

mocks.useWatchedMovies.mockImplementation(() => ({
  instances: mocks.instances,
  count: 0,
  isLoading: mocks.isLoading,
  addWatchInstance: mocks.addWatchInstance,
  clearAllWatches: mocks.clearAllWatches,
  deleteWatchInstance: mocks.deleteWatchInstance,
  updateWatchInstance: mocks.updateWatchInstance,
}))

function createList(listId: string, itemKey: string): UserList {
  return {
    id: listId,
    name: listId,
    items: {
      [itemKey]: {
        id: 123,
        title: "Test Title",
        poster_path: null,
        media_type: "tv",
        addedAt: 0,
      },
    },
    createdAt: 0,
    isCustom: true,
  }
}

function createMedia(): TMDBMedia {
  return {
    id: 123,
    media_type: "tv",
    adult: false,
    backdrop_path: null,
    poster_path: null,
    name: "Test Show",
    original_name: "Test Show",
    overview: "Overview",
    genre_ids: [],
    popularity: 0,
    first_air_date: "",
    vote_average: 0,
    vote_count: 0,
    original_language: "en",
  }
}

describe("useMediaActions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.lists = []
    mocks.instances = []
    mocks.isLoading = false
    mocks.preferences.showListIndicators = false
    mocks.preferences.quickMarkAsWatched = false
    mocks.getRating.mockReturnValue(null)
    mocks.getNote.mockReturnValue(null)
    mocks.useWatchedMovies.mockClear()
  })

  it("uses add-to-list appearance for the dropdown even when list indicators are disabled", () => {
    mocks.lists = [createList("road-trip", "123")]

    const { result } = renderHook(() =>
      useMediaActions({
        media: createMedia(),
        mediaType: "tv",
      }),
    )

    expect(result.current.isInAnyList).toBe(true)
    expect(result.current.listIds).toBeUndefined()
    expect(result.current.addToListAppearance.iconKey).toBe("custom")
    expect(result.current.dropdownItems[0]?.label).toBe("In List")

    const AddToListIcon = result.current.dropdownItems[0]?.icon
    expect(AddToListIcon).toBeDefined()
    if (!AddToListIcon) {
      throw new Error("Expected add-to-list dropdown icon")
    }

    const { container } = render(<AddToListIcon className="menu-icon" />)
    const icon = container.querySelector("[data-add-to-list-icon]")

    expect(icon).not.toBeNull()
    if (!icon) {
      throw new Error("Expected rendered dropdown icon")
    }
    expect(icon).toHaveAttribute("data-add-to-list-icon", "custom")
    expect(icon.getAttribute("class") ?? "").toContain("menu-icon")
    expect(icon.getAttribute("class") ?? "").toContain("text-violet-400")
  })

  it("keeps watched history queries disabled for card dropdown flows", () => {
    const movie: TMDBMedia = {
      ...createMedia(),
      media_type: "movie",
      title: "Test Movie",
      original_title: "Test Movie",
      release_date: "2024-03-27",
    } as TMDBMedia

    const { result } = renderHook(() =>
      useMediaActions({
        media: movie,
        mediaType: "movie",
      }),
    )

    expect(mocks.useWatchedMovies).toHaveBeenLastCalledWith(123, {
      enabled: false,
    })

    const watchedItem = result.current.dropdownItems.find(
      (item) => item.id === "mark-as-watched",
    )

    if (!watchedItem?.onClick) {
      throw new Error("Expected mark-as-watched dropdown item")
    }

    act(() => {
      watchedItem.onClick?.()
    })

    expect(mocks.useWatchedMovies).toHaveBeenLastCalledWith(123, {
      enabled: false,
    })
  })
})
