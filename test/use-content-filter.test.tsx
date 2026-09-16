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
    hideTalkShowsAndAwards: false,
  },
  premiumStatus: "premium",
  user: { uid: "user-1" } as { uid: string } | null,
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
    mocks.preferences.hideTalkShowsAndAwards = false
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

  it("hides talk shows and award ceremonies when the preference is on", () => {
    mocks.preferences.hideTalkShowsAndAwards = true
    const items = [
      {
        id: 1408,
        media_type: "tv" as const,
        name: "Saturday Night Live",
        genre_ids: [35],
      },
      {
        id: 2316,
        media_type: "tv" as const,
        name: "The West Wing",
        genre_ids: [18],
      },
    ]

    const { result } = renderHook(() => useContentFilter(items))

    expect(result.current).toEqual([items[1]])
  })

  it("keeps talk shows when the preference is off", () => {
    mocks.preferences.hideTalkShowsAndAwards = false
    const items = [
      {
        id: 1408,
        media_type: "tv" as const,
        name: "Saturday Night Live",
        genre_ids: [35],
      },
    ]

    const { result } = renderHook(() => useContentFilter(items))

    expect(result.current).toBe(items)
  })

  it("never hides movies, even Oscar winners", () => {
    mocks.preferences.hideTalkShowsAndAwards = true
    const items = [
      {
        id: 872585,
        media_type: "movie" as const,
        title: "Oppenheimer",
        genre_ids: [18],
      },
    ]

    const { result } = renderHook(() => useContentFilter(items))

    expect(result.current).toBe(items)
  })

  it("filters talk shows for guests using the default-ON preference", () => {
    mocks.user = null
    // The stored preference is irrelevant for guests — the shipped default
    // (ON) applies, matching mobile.
    mocks.preferences.hideTalkShowsAndAwards = false
    const items = [
      {
        id: 1408,
        media_type: "tv" as const,
        name: "Saturday Night Live",
        genre_ids: [35],
      },
      {
        id: 2316,
        media_type: "tv" as const,
        name: "The West Wing",
        genre_ids: [18],
      },
    ]

    const { result } = renderHook(() => useContentFilter(items))

    expect(result.current).toEqual([items[1]])
  })

  it("returns the same ref for guests when nothing matches", () => {
    mocks.user = null
    const items = [
      {
        id: 2316,
        media_type: "tv" as const,
        name: "The West Wing",
        genre_ids: [18],
      },
    ]

    const { result } = renderHook(() => useContentFilter(items))

    expect(result.current).toBe(items)
  })

  it("still skips the watched filter for guests", () => {
    mocks.user = null
    mocks.preferences.hideWatchedContent = true
    mocks.lists = [
      {
        id: "already-watched",
        items: {
          "movie-123": {
            id: 123,
            media_type: "movie",
          },
        },
      },
    ]

    const { result } = renderHook(() => useContentFilter(movieItems))

    // Guest behavior for hideWatchedContent is unchanged: no filtering.
    expect(result.current).toBe(movieItems)
  })
})
