import { useContentFilter } from "@/hooks/use-content-filter"
import { renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  lists: [] as Array<{
    id: string
    items: Record<string, { id: number; media_type: "movie" | "tv" }>
  }>,
  preferences: {
    hideUnreleasedContent: false,
    hideWatchedContent: false,
  },
  premiumStatus: "premium",
  user: { uid: "user-1" },
}))

vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({
    premiumStatus: mocks.premiumStatus,
    user: mocks.user,
  }),
}))

vi.mock("@/hooks/use-lists", () => ({
  useLists: () => ({
    lists: mocks.lists,
  }),
}))

vi.mock("@/hooks/use-preferences", () => ({
  usePreferences: () => ({
    preferences: mocks.preferences,
  }),
}))

const movieItems = [
  {
    id: 123,
    media_type: "movie" as const,
    release_date: "2024-03-27",
  },
]

describe("useContentFilter", () => {
  beforeEach(() => {
    mocks.lists = []
    mocks.preferences.hideUnreleasedContent = false
    mocks.preferences.hideWatchedContent = false
    mocks.premiumStatus = "premium"
    mocks.user = { uid: "user-1" }
  })

  it.each(["123", "movie-123"])(
    'hides watched movies when "already-watched" contains %s',
    (itemKey) => {
      mocks.preferences.hideWatchedContent = true
      mocks.lists = [
        {
          id: "already-watched",
          items: {
            [itemKey]: {
              id: 123,
              media_type: "movie",
            },
          },
        },
      ]

      const { result } = renderHook(() => useContentFilter(movieItems))

      expect(result.current).toEqual([])
    },
  )
})
