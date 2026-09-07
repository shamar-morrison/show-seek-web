import { useOpenWithItems } from "@/hooks/use-open-with-items"
import { render, renderHook, waitFor } from "@/test/utils"
import React from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const fetchMock = vi.fn()
const openMock = vi.fn()

describe("useOpenWithItems", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("fetch", fetchMock)
    vi.stubGlobal("open", openMock)
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ imdbId: "tt1375666", traktSlug: null }),
    })
  })

  it("returns one item per service and opens the direct link on click", async () => {
    const { result } = renderHook(() =>
      useOpenWithItems({
        mediaType: "movie",
        mediaId: 123,
        title: "Inception",
        year: "2010",
      }),
    )

    expect(result.current).toHaveLength(8)

    const imdbItem = result.current.find(
      (item) => item.type === "action" && item.key === "open-with-imdb",
    )
    expect(imdbItem?.type).toBe("action")

    if (imdbItem?.type === "action") {
      imdbItem.onClick()
    }

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/open-with?mediaType=movie&mediaId=123",
      )
    })
    await waitFor(() => {
      expect(openMock).toHaveBeenCalledWith(
        "https://www.imdb.com/title/tt1375666/",
        "_blank",
        "noopener,noreferrer",
      )
    })
  })

  it("exposes a brand icon for every service", () => {
    function Probe() {
      const items = useOpenWithItems({
        mediaType: "tv",
        mediaId: 456,
        title: "Severance",
        year: "2022",
      })
      return (
        <div>
          {items.map((item) =>
            item.type === "action" && React.isValidElement(item.icon) ? (
              <span key={item.key} data-testid={item.key}>
                {item.icon}
              </span>
            ) : null,
          )}
        </div>
      )
    }

    const { container } = render(<Probe />)

    expect(container.querySelectorAll("img").length).toBe(6)
    expect(
      container.querySelector('[data-testid="open-with-imdb"] img'),
    ).toHaveAttribute("src", "/imdb-logo.png")
    expect(
      container.querySelector('[data-testid="open-with-tmdb"] img'),
    ).toHaveAttribute("src", "/tmdb-logo.png")
    expect(
      container.querySelector('[data-testid="open-with-letterboxd"] img'),
    ).toHaveAttribute("src", "/letterboxd-logo.png")
    // Wikipedia / Web Search fall back to Hugeicons glyphs
    expect(
      container.querySelector('[data-testid="open-with-wikipedia"] svg'),
    ).not.toBeNull()
    expect(
      container.querySelector('[data-testid="open-with-webSearch"] svg'),
    ).not.toBeNull()
  })

  it("falls back to search URLs when the lookup fails", async () => {
    fetchMock.mockRejectedValue(new Error("network down"))

    const { result } = renderHook(() =>
      useOpenWithItems({
        mediaType: "movie",
        mediaId: 123,
        title: "Inception",
        year: "2010",
      }),
    )

    const imdbItem = result.current.find(
      (item) => item.type === "action" && item.key === "open-with-imdb",
    )

    if (imdbItem?.type === "action") {
      imdbItem.onClick()
    }

    await waitFor(() => {
      expect(openMock).toHaveBeenCalledWith(
        "https://www.imdb.com/find/?q=Inception%202010&s=tt",
        "_blank",
        "noopener,noreferrer",
      )
    })
  })
})
