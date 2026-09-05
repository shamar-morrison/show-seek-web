import {
  buildShareCaption,
  canvasToPngBlob,
  copyPngToClipboard,
  copyTextToClipboard,
  downloadPng,
  getSharePostFilename,
  renderShareCard,
  SHARE_CARD_HEIGHT,
  SHARE_CARD_WIDTH,
  type SharePostMedia,
} from "@/lib/share-post"
import { beforeEach, describe, expect, it, vi } from "vitest"

function createMedia(overrides: Partial<SharePostMedia> = {}): SharePostMedia {
  return {
    id: 123,
    mediaType: "movie",
    title: "Inception",
    posterUrl: null,
    backdropUrl: null,
    releaseYear: "2010",
    genres: ["Sci-Fi", "Action"],
    userRating: 9,
    ...overrides,
  }
}

function createFakeContext() {
  const gradient = { addColorStop: vi.fn() }
  const target: Record<string, unknown> = {}
  return new Proxy(target, {
    get: (target, prop) => {
      if (prop === "measureText") return () => ({ width: 10 })
      if (prop === "createLinearGradient") return () => gradient
      if (!(prop in target)) {
        target[prop as string] = vi.fn()
      }
      return target[prop as string]
    },
    set: (target, prop, value) => {
      target[prop as string] = value
      if (prop === "font") {
        const history = (target.__fonts ??= []) as unknown[]
        history.push(value)
      }
      return true
    },
  })
}

describe("buildShareCaption", () => {
  it("includes title, year, and rating when rated", () => {
    expect(
      buildShareCaption({ title: "Severance", releaseYear: "2022", userRating: 9 }),
    ).toBe("Check out Severance (2022) on ShowSeek! My rating: 9/10.")
  })

  it("omits the rating when unrated", () => {
    expect(
      buildShareCaption({ title: "Dune", releaseYear: "2021", userRating: 0 }),
    ).toBe("Check out Dune (2021) on ShowSeek!")
  })

  it("omits the year when unknown", () => {
    expect(
      buildShareCaption({ title: "Dune", releaseYear: "", userRating: 0 }),
    ).toBe("Check out Dune on ShowSeek!")
  })
})

describe("getSharePostFilename", () => {
  it("builds a filename from media type and id", () => {
    expect(getSharePostFilename({ mediaType: "tv", id: 456 })).toBe(
      "showseek-tv-456.png",
    )
  })
})

describe("renderShareCard", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  function mockCanvas() {
    const fakeCtx = createFakeContext()
    const canvasEl = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => fakeCtx),
    }
    vi.spyOn(document, "createElement").mockImplementation(((tagName: string) => {
      if (tagName === "canvas") return canvasEl
      const real = Document.prototype.createElement.bind(document)
      return real(tagName)
    }) as typeof document.createElement)
    return { canvasEl, fakeCtx: fakeCtx as unknown as Record<string, unknown> }
  }

  it("renders a 1080x1920 card on the gradient fallback without artwork", async () => {
    const { canvasEl, fakeCtx } = mockCanvas()

    const canvas = await renderShareCard(createMedia())

    expect(canvas).toBe(canvasEl)
    expect(canvasEl.width).toBe(SHARE_CARD_WIDTH)
    expect(canvasEl.height).toBe(SHARE_CARD_HEIGHT)
    const fillText = fakeCtx["fillText"] as ReturnType<typeof vi.fn>
    const drawnStrings = fillText.mock.calls.map((call) => call[0] as string)
    expect(drawnStrings).toContain("Inception")
    expect(drawnStrings).toContain("2010 • Sci-Fi, Action")
    expect(drawnStrings).toContain("My Rating")
    expect(drawnStrings).toContain("9/10")
    expect(drawnStrings).not.toContain("Rate it on ShowSeek!")
    expect(drawnStrings).toContain("ShowSeek")
    // Larger score with breathing room above the rating block
    const fonts = fakeCtx["__fonts"] as string[]
    expect(fonts).toContain(
      "700 120px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    )
  })

  it("formats decimal ratings with one decimal place", async () => {
    const { fakeCtx } = mockCanvas()

    await renderShareCard(createMedia({ userRating: 8.5 }))

    const fillText = fakeCtx["fillText"] as ReturnType<typeof vi.fn>
    const drawnStrings = fillText.mock.calls.map((call) => call[0] as string)
    expect(drawnStrings).toContain("8.5/10")
  })

  it("shows the rate CTA when unrated and draws loaded artwork", async () => {
    const { fakeCtx } = mockCanvas()

    class FakeImage {
      crossOrigin = ""
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      width = 1000
      height = 1500
      set src(_value: string) {
        window.setTimeout(() => this.onload?.(), 0)
      }
    }
    vi.stubGlobal("Image", FakeImage)

    try {
      await renderShareCard(
        createMedia({
          posterUrl: "https://image.tmdb.org/t/p/original/poster.jpg",
          userRating: 0,
        }),
      )

      const fillText = fakeCtx["fillText"] as ReturnType<typeof vi.fn>
      const drawnStrings = fillText.mock.calls.map((call) => call[0] as string)
      expect(drawnStrings).toContain("Rate it on ShowSeek!")
      expect(drawnStrings).not.toContain("My Rating")
      expect(drawnStrings.some((text) => text.includes("/10"))).toBe(false)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it("falls back to gradient when artwork fails to load", async () => {
    mockCanvas()

    class BrokenImage {
      crossOrigin = ""
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      set src(_value: string) {
        window.setTimeout(() => this.onerror?.(), 0)
      }
    }
    vi.stubGlobal("Image", BrokenImage)

    try {
      const canvas = await renderShareCard(
        createMedia({
          posterUrl: "https://example.com/broken.jpg",
          backdropUrl: "https://example.com/broken-bg.jpg",
        }),
      )

      expect(canvas.width).toBe(SHARE_CARD_WIDTH)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it("prefers the poster for the blurred background like mobile", async () => {
    mockCanvas()
    const loadedUrls: string[] = []

    class RecordingImage {
      crossOrigin = ""
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      width = 1000
      height = 1500
      set src(value: string) {
        loadedUrls.push(value)
        window.setTimeout(() => this.onload?.(), 0)
      }
    }
    vi.stubGlobal("Image", RecordingImage)

    try {
      await renderShareCard(
        createMedia({
          posterUrl: "https://image.tmdb.org/t/p/original/poster.jpg",
          backdropUrl: "https://image.tmdb.org/t/p/original/backdrop.jpg",
        }),
      )

      // Background first, then the foreground poster
      expect(loadedUrls).toEqual([
        "https://image.tmdb.org/t/p/original/poster.jpg",
        "https://image.tmdb.org/t/p/original/poster.jpg",
      ])
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it("falls back to the backdrop for the background when no poster exists", async () => {
    mockCanvas()
    const loadedUrls: string[] = []

    class RecordingImage {
      crossOrigin = ""
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      width = 1920
      height = 1080
      set src(value: string) {
        loadedUrls.push(value)
        window.setTimeout(() => this.onload?.(), 0)
      }
    }
    vi.stubGlobal("Image", RecordingImage)

    try {
      await renderShareCard(
        createMedia({
          posterUrl: null,
          backdropUrl: "https://image.tmdb.org/t/p/original/backdrop.jpg",
        }),
      )

      expect(loadedUrls).toEqual([
        "https://image.tmdb.org/t/p/original/backdrop.jpg",
      ])
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

describe("canvasToPngBlob", () => {
  it("resolves the encoded blob", async () => {
    const blob = new Blob(["png"], { type: "image/png" })
    const canvas = {
      toBlob: (callback: (blob: Blob | null) => void) =>
        callback(blob),
    } as unknown as HTMLCanvasElement

    await expect(canvasToPngBlob(canvas)).resolves.toBe(blob)
  })

  it("rejects when encoding fails", async () => {
    const canvas = {
      toBlob: (callback: (blob: Blob | null) => void) => callback(null),
    } as unknown as HTMLCanvasElement

    await expect(canvasToPngBlob(canvas)).rejects.toThrow(
      "Failed to encode PNG",
    )
  })
})

describe("copyPngToClipboard", () => {
  it("throws when image clipboard is unsupported", async () => {
    vi.stubGlobal("ClipboardItem", undefined)
    try {
      await expect(
        copyPngToClipboard(new Blob(["png"], { type: "image/png" })),
      ).rejects.toThrow()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it("writes a PNG ClipboardItem when supported", async () => {
    const write = vi.fn(async () => {})
    const seen: unknown[] = []
    class FakeClipboardItem {
      constructor(public data: Record<string, Blob>) {
        seen.push(data)
      }
    }
    vi.stubGlobal("ClipboardItem", FakeClipboardItem)
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { write },
    })

    try {
      const blob = new Blob(["png"], { type: "image/png" })
      await copyPngToClipboard(blob)

      expect(write).toHaveBeenCalledTimes(1)
      expect(seen[0]).toEqual({ "image/png": blob })
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

describe("copyTextToClipboard", () => {
  it("uses clipboard.writeText when available", async () => {
    const writeText = vi.fn(async () => {})
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    })

    await copyTextToClipboard("hello")

    expect(writeText).toHaveBeenCalledWith("hello")
  })

  it("falls back to execCommand when writeText fails", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async () => { throw new Error("denied") } },
    })
    const execCommand = vi.fn(() => true)
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: execCommand,
    })

    try {
      await copyTextToClipboard("hello")

      expect(execCommand).toHaveBeenCalledWith("copy")
    } finally {
      // @ts-expect-error jsdom lacks execCommand; remove the test shim
      delete document.execCommand
    }
  })
})

describe("downloadPng", () => {
  it("triggers an anchor download", () => {
    vi.useFakeTimers()
    const click = vi.spyOn(
      HTMLAnchorElement.prototype,
      "click",
    ).mockImplementation(() => {})
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:url")
    const revoke = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => {})

    try {
      downloadPng(new Blob(["png"]), "showseek-movie-1.png")

      expect(click).toHaveBeenCalledTimes(1)
      vi.runAllTimers()
      expect(revoke).toHaveBeenCalledWith("blob:url")
    } finally {
      vi.useRealTimers()
      vi.restoreAllMocks()
    }
  })
})
