import { SearchDropdown } from "@/components/search-dropdown"
import { fireEvent, render, screen, waitFor } from "@/test/utils"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  searchMedia: vi.fn(),
  user: null as { uid: string; isAnonymous: boolean } | null,
  preferences: {
    hideUnreleasedContent: false,
    hideWatchedContent: false,
    hideTalkShowsAndAwards: false,
    posterOverrides: {},
  },
}))

const originalMatchMedia = window.matchMedia
const originalNavigatorPlatform = window.navigator.platform

vi.mock("@/app/server-actions/search", () => ({
  searchMedia: (...args: unknown[]) => mocks.searchMedia(...args),
}))

vi.mock("nextjs-toploader/app", () => ({
  useRouter: () => ({
    push: mocks.push,
  }),
}))

vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({
    user: mocks.user,
    loading: false,
    premiumStatus: "premium",
  }),
}))

vi.mock("@/hooks/use-lists", () => ({
  useLists: () => ({
    lists: [],
  }),
}))

vi.mock("@/hooks/use-preferences", () => ({
  usePreferences: () => ({
    preferences: mocks.preferences,
  }),
}))

function mockDesktopMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn((query: string) => ({
    matches: query === "(min-width: 1024px)" ? matches : false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  })) as typeof window.matchMedia
}

function mockNavigatorPlatform(platform: string) {
  Object.defineProperty(window.navigator, "platform", {
    configurable: true,
    value: platform,
  })
}

describe("SearchDropdown", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDesktopMatchMedia(true)
    mockNavigatorPlatform("MacIntel")
    mocks.user = null
    mocks.preferences.hideUnreleasedContent = false
    mocks.preferences.hideWatchedContent = false
    mocks.preferences.hideTalkShowsAndAwards = false
    mocks.searchMedia.mockResolvedValue({
      page: 1,
      results: [],
      total_pages: 0,
      total_results: 0,
    })
  })

  afterEach(() => {
    window.matchMedia = originalMatchMedia
    mockNavigatorPlatform(originalNavigatorPlatform)
  })

  it("focuses the desktop search on Meta+K", () => {
    render(<SearchDropdown />)

    const input = screen.getByPlaceholderText("Search...")
    const trigger = document.createElement("button")
    document.body.appendChild(trigger)
    trigger.focus()

    fireEvent.keyDown(document, { key: "k", metaKey: true })

    expect(input).toHaveFocus()
    trigger.remove()
  })

  it("focuses the desktop search on Control+K", () => {
    render(<SearchDropdown />)

    const input = screen.getByPlaceholderText("Search...")
    const trigger = document.createElement("button")
    document.body.appendChild(trigger)
    trigger.focus()

    fireEvent.keyDown(document, { key: "k", ctrlKey: true })

    expect(input).toHaveFocus()
    trigger.remove()
  })

  it("does not steal focus from another editable field", () => {
    render(
      <>
        <SearchDropdown />
        <input aria-label="Other input" />
      </>,
    )

    const searchInput = screen.getByPlaceholderText("Search...")
    const otherInput = screen.getByLabelText("Other input")
    otherInput.focus()

    fireEvent.keyDown(document, { key: "k", metaKey: true })

    expect(otherInput).toHaveFocus()
    expect(searchInput).not.toHaveFocus()
  })

  it("ignores the shortcut below the desktop breakpoint", () => {
    mockDesktopMatchMedia(false)

    render(<SearchDropdown />)

    const searchInput = screen.getByPlaceholderText("Search...")
    const trigger = document.createElement("button")
    document.body.appendChild(trigger)
    trigger.focus()

    fireEvent.keyDown(document, { key: "k", metaKey: true })

    expect(trigger).toHaveFocus()
    expect(searchInput).not.toHaveFocus()
    trigger.remove()
  })

  it("shows the shortcut hint when the search is empty", () => {
    render(<SearchDropdown />)

    expect(screen.getByText("⌘K")).toBeInTheDocument()
  })

  it("navigates to the search page on Enter", () => {
    render(<SearchDropdown />)

    const input = screen.getByPlaceholderText("Search...")

    fireEvent.change(input, { target: { value: "alien" } })
    fireEvent.keyDown(input, { key: "Enter" })

    expect(mocks.push).toHaveBeenCalledWith("/search?q=alien")
  })

  it("hides the shortcut hint once the user types", () => {
    render(<SearchDropdown />)

    const input = screen.getByPlaceholderText("Search...")

    fireEvent.change(input, { target: { value: "alien" } })

    expect(screen.queryByText("⌘K")).not.toBeInTheDocument()
  })

  it("shows clear button when query is present and clicking it resets the input and refocuses", () => {
    render(<SearchDropdown />)

    const input = screen.getByPlaceholderText("Search...")

    expect(
      screen.queryByRole("button", { name: "Clear search" }),
    ).not.toBeInTheDocument()

    fireEvent.change(input, { target: { value: "alien" } })

    const clearButton = screen.getByRole("button", { name: "Clear search" })
    expect(clearButton).toBeInTheDocument()

    fireEvent.click(clearButton)

    expect(input).toHaveValue("")
    expect(
      screen.queryByRole("button", { name: "Clear search" }),
    ).not.toBeInTheDocument()
    expect(screen.getByText("⌘K")).toBeInTheDocument()
    expect(document.activeElement).toBe(input)
  })

  it("hides talk shows from dropdown results when the preference is on", async () => {
    mocks.user = { uid: "user-1", isAnonymous: false }
    mocks.preferences.hideTalkShowsAndAwards = true
    mocks.searchMedia.mockResolvedValue({
      page: 1,
      results: [
        {
          id: 1408,
          media_type: "tv",
          name: "Saturday Night Live",
          genre_ids: [35],
          poster_path: null,
          popularity: 10,
          vote_average: 6,
        },
        {
          id: 2316,
          media_type: "tv",
          name: "The West Wing",
          genre_ids: [18],
          poster_path: null,
          popularity: 10,
          vote_average: 8,
        },
      ],
      total_pages: 1,
      total_results: 2,
    })

    render(<SearchDropdown />)

    fireEvent.change(screen.getByPlaceholderText("Search..."), {
      target: { value: "live" },
    })

    await waitFor(
      () => {
        expect(screen.getByText("The West Wing")).toBeInTheDocument()
      },
      { timeout: 3000 },
    )
    expect(screen.queryByText("Saturday Night Live")).not.toBeInTheDocument()
  })

  it("shows talk shows in dropdown results when the preference is off", async () => {
    mocks.user = { uid: "user-1", isAnonymous: false }
    mocks.preferences.hideTalkShowsAndAwards = false
    mocks.searchMedia.mockResolvedValue({
      page: 1,
      results: [
        {
          id: 1408,
          media_type: "tv",
          name: "Saturday Night Live",
          genre_ids: [35],
          poster_path: null,
          popularity: 10,
          vote_average: 6,
        },
      ],
      total_pages: 1,
      total_results: 1,
    })

    render(<SearchDropdown />)

    fireEvent.change(screen.getByPlaceholderText("Search..."), {
      target: { value: "live" },
    })

    await waitFor(
      () => {
        expect(screen.getByText("Saturday Night Live")).toBeInTheDocument()
      },
      { timeout: 3000 },
    )
  })
})
