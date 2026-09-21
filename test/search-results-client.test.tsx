import { SearchResultsClient } from "@/app/search/search-results-client"
import { fireEvent, render, screen } from "@/test/utils"
import type { TMDBSearchResponse } from "@/types/tmdb"
import { describe, expect, it, vi } from "vitest"

const initialResults: TMDBSearchResponse = {
  page: 1,
  results: [],
  total_pages: 0,
  total_results: 0,
}

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
}))

vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    premiumStatus: "free",
  }),
}))

vi.mock("@/hooks/use-lists", () => ({
  useLists: () => ({
    lists: [],
  }),
}))

vi.mock("@/app/server-actions/search", () => ({
  searchMedia: vi.fn().mockResolvedValue({
    page: 1,
    results: [],
    total_pages: 0,
    total_results: 0,
  }),
}))

vi.mock("@/hooks/use-preferences", () => ({
  usePreferences: () => ({
    preferences: {
      hideUnreleasedContent: false,
      hideWatchedContent: false,
      hideTalkShowsAndAwards: false,
      posterOverrides: {},
      showOriginalTitles: false,
    },
  }),
}))

vi.mock("@/hooks/use-trailer", () => ({
  useTrailer: () => ({
    isOpen: false,
    activeTrailer: null,
    loadingMediaId: null,
    watchTrailer: vi.fn(),
    closeTrailer: vi.fn(),
  }),
}))

describe("SearchResultsClient clear button", () => {
  it("renders clear button when query is present and clears input on click", () => {
    window.history.pushState({}, "", "/search?q=Dark")

    render(
      <SearchResultsClient
        initialQuery="Dark"
        initialResults={initialResults}
      />,
    )

    const input = screen.getByPlaceholderText(
      "Search movies, TV shows, and people...",
    )
    expect(input).toHaveValue("Dark")

    const clearButton = screen.getByRole("button", { name: "Clear search" })
    expect(clearButton).toBeInTheDocument()

    fireEvent.click(clearButton)

    expect(input).toHaveValue("")
    expect(
      screen.queryByRole("button", { name: "Clear search" }),
    ).not.toBeInTheDocument()
    expect(document.activeElement).toBe(input)
  })

  it("shows clear button when typing into empty input and clears on click", () => {
    window.history.pushState({}, "", "/search")

    render(
      <SearchResultsClient
        initialQuery=""
        initialResults={initialResults}
      />,
    )

    const input = screen.getByPlaceholderText(
      "Search movies, TV shows, and people...",
    )
    expect(input).toHaveValue("")
    expect(
      screen.queryByRole("button", { name: "Clear search" }),
    ).not.toBeInTheDocument()

    fireEvent.change(input, { target: { value: "Severance" } })

    const clearButton = screen.getByRole("button", { name: "Clear search" })
    expect(clearButton).toBeInTheDocument()

    fireEvent.click(clearButton)

    expect(input).toHaveValue("")
    expect(
      screen.queryByRole("button", { name: "Clear search" }),
    ).not.toBeInTheDocument()
    expect(document.activeElement).toBe(input)
  })
})
