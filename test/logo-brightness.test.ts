import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void

  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve
  })

  return {
    promise,
    resolve,
  }
}

function createImageResponse(): Response {
  return new Response(new Blob(["image"], { type: "image/png" }), {
    headers: {
      "content-type": "image/png",
    },
    status: 200,
  })
}

async function waitForAssertion(assertion: () => void): Promise<void> {
  let lastError: unknown

  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      assertion()
      return
    } catch (error) {
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
  }

  throw lastError
}

describe("logo brightness", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("defaults to false when image analysis runtime is unavailable", async () => {
    const { isLogoDark } = await import("../lib/logo-brightness")

    await expect(isLogoDark("https://image.example/logo.png")).resolves.toBe(
      false,
    )
  })

  it("downscales large bitmaps before reading pixel data", async () => {
    const drawImageMock = vi.fn()
    const fetchMock = vi.fn(async () => createImageResponse())
    const getImageDataMock = vi.fn(() => ({
      data: new Uint8ClampedArray([0, 0, 0, 255]),
    }))
    const closeMock = vi.fn()
    const canvasInstances: Array<{ height: number; width: number }> = []

    class FakeOffscreenCanvas {
      constructor(
        readonly width: number,
        readonly height: number,
      ) {
        canvasInstances.push({ height, width })
      }

      getContext() {
        return {
          drawImage: drawImageMock,
          getImageData: getImageDataMock,
        }
      }
    }

    vi.stubGlobal(
      "OffscreenCanvas",
      FakeOffscreenCanvas as unknown as typeof OffscreenCanvas,
    )
    vi.stubGlobal("fetch", fetchMock)
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({
        close: closeMock,
        height: 512,
        width: 1024,
      })),
    )

    const { isLogoDark } = await import("../lib/logo-brightness")

    await expect(isLogoDark("https://image.example/logo.png")).resolves.toBe(
      true,
    )
    expect(canvasInstances).toEqual([{ height: 32, width: 64 }])
    expect(getImageDataMock).toHaveBeenCalledWith(0, 0, 64, 32)
    expect(drawImageMock).toHaveBeenCalledWith(
      expect.objectContaining({ height: 512, width: 1024 }),
      0,
      0,
      1024,
      512,
      0,
      0,
      64,
      32,
    )
    expect(closeMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      "https://image.example/logo.png",
      expect.objectContaining({
        cache: "force-cache",
        signal: expect.any(AbortSignal),
      }),
    )
  })

  it("does not treat saturated dark colors as black logos", async () => {
    class FakeOffscreenCanvas {
      constructor(readonly width: number, readonly height: number) {}

      getContext() {
        return {
          drawImage: vi.fn(),
          getImageData: vi.fn(() => ({
            data: new Uint8ClampedArray([80, 0, 0, 255]),
          })),
        }
      }
    }

    vi.stubGlobal(
      "OffscreenCanvas",
      FakeOffscreenCanvas as unknown as typeof OffscreenCanvas,
    )
    vi.stubGlobal("fetch", vi.fn(async () => createImageResponse()))
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({
        close: vi.fn(),
        height: 64,
        width: 64,
      })),
    )

    const { isLogoDark } = await import("../lib/logo-brightness")

    await expect(isLogoDark("https://image.example/logo.png")).resolves.toBe(
      false,
    )
  })

  it("deduplicates logo analysis and caps concurrent work while preserving order", async () => {
    const deferredByUrl = new Map<string, ReturnType<typeof createDeferred<Response>>>()
    const mediaList = [
      { id: "1", isDarkLogo: false, logoUrl: "https://image.example/a.png" },
      { id: "2", isDarkLogo: false, logoUrl: "https://image.example/b.png" },
      { id: "3", isDarkLogo: false, logoUrl: "https://image.example/a.png" },
      { id: "4", isDarkLogo: false, logoUrl: "https://image.example/c.png" },
      { id: "5", isDarkLogo: false, logoUrl: "https://image.example/d.png" },
      { id: "6", isDarkLogo: false, logoUrl: "https://image.example/e.png" },
    ]
    let activeFetches = 0
    let maxConcurrentFetches = 0

    for (const media of mediaList) {
      if (!deferredByUrl.has(media.logoUrl)) {
        deferredByUrl.set(media.logoUrl, createDeferred<Response>())
      }
    }

    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = input.toString()
      const deferred = deferredByUrl.get(url)

      if (!deferred) {
        throw new Error(`Unexpected logo URL: ${url}`)
      }

      activeFetches += 1
      maxConcurrentFetches = Math.max(maxConcurrentFetches, activeFetches)
      const response = await deferred.promise
      activeFetches -= 1
      return response
    })

    class FakeOffscreenCanvas {
      constructor(readonly width: number, readonly height: number) {}

      getContext() {
        return {
          drawImage: vi.fn(),
          getImageData: vi.fn(() => ({
            data: new Uint8ClampedArray([0, 0, 0, 255]),
          })),
        }
      }
    }

    vi.stubGlobal("fetch", fetchMock)
    vi.stubGlobal(
      "OffscreenCanvas",
      FakeOffscreenCanvas as unknown as typeof OffscreenCanvas,
    )
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({
        close: vi.fn(),
        height: 64,
        width: 64,
      })),
    )

    const { enrichHeroMediaWithBrightness } = await import(
      "../lib/logo-brightness"
    )

    const resultPromise = enrichHeroMediaWithBrightness(mediaList)

    await waitForAssertion(() => {
      expect(fetchMock).toHaveBeenCalledTimes(4)
    })
    expect(maxConcurrentFetches).toBe(4)

    deferredByUrl.get("https://image.example/a.png")?.resolve(createImageResponse())
    await waitForAssertion(() => {
      expect(fetchMock).toHaveBeenCalledTimes(5)
    })

    deferredByUrl.get("https://image.example/b.png")?.resolve(createImageResponse())
    deferredByUrl.get("https://image.example/c.png")?.resolve(createImageResponse())
    deferredByUrl.get("https://image.example/d.png")?.resolve(createImageResponse())
    deferredByUrl.get("https://image.example/e.png")?.resolve(createImageResponse())

    const results = await resultPromise

    expect(fetchMock).toHaveBeenCalledTimes(5)
    expect(maxConcurrentFetches).toBe(4)
    expect(results.map((media) => media.id)).toEqual(["1", "2", "3", "4", "5", "6"])
    expect(results.every((media) => media.isDarkLogo)).toBe(true)
  })
})
