import { render } from "@/test/utils"
import { useMediaActions } from "@/hooks/use-media-actions"
import type { UserList } from "@/types/list"
import type { TMDBMedia } from "@/types/tmdb"
import { renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  addWatchInstance: vi.fn(),
  clearAllWatches: vi.fn(),
  closeModal: vi.fn(),
  getNote: vi.fn(),
  getRating: vi.fn(),
  lists: [] as UserList[],
  preferences: {
    showListIndicators: false,
    quickMarkAsWatched: false,
    autoAddToAlreadyWatched: false,
    autoRemoveFromShouldWatch: false,
  },
  requireAuth: vi.fn((callback?: () => void) => callback?.()),
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
  useWatchedMovies: () => ({
    count: 0,
    addWatchInstance: mocks.addWatchInstance,
    clearAllWatches: mocks.clearAllWatches,
  }),
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
    mocks.preferences.showListIndicators = false
    mocks.getRating.mockReturnValue(null)
    mocks.getNote.mockReturnValue(null)
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
})
