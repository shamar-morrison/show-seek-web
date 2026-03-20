import { SearchDropdown } from "@/components/search-dropdown"
import { fireEvent, render, screen } from "@/test/utils"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  searchMedia: vi.fn(),
}))

const originalMatchMedia = window.matchMedia
const originalNavigatorPlatform = window.navigator.platform

vi.mock("@/app/server-actions/search", () => ({
  searchMedia: (...args: unknown[]) => mocks.searchMedia(...args),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mocks.push,
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

  it("hides the shortcut hint once the user types", () => {
    render(<SearchDropdown />)

    const input = screen.getByPlaceholderText("Search...")

    fireEvent.change(input, { target: { value: "alien" } })

    expect(screen.queryByText("⌘K")).not.toBeInTheDocument()
  })
})
