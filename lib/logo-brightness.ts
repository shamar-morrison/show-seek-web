/**
 * Logo Brightness Analysis Utility
 * Analyzes logo images to determine if they are predominantly dark
 * Used server-side during data fetching for zero client-side overhead
 */

import "server-only"

/**
 * Luminance threshold below which a logo is considered "dark"
 * Range: 0-255, where 0 is black and 255 is white
 * A threshold of 80 catches most black/dark monochrome logos
 */
const DARK_LUMINANCE_THRESHOLD = 80
const DARK_NEUTRAL_SATURATION_THRESHOLD = 0.2
const LOGO_ANALYSIS_CONCURRENCY = 4
const LOGO_ANALYSIS_MAX_DIMENSION = 64
const LOGO_FETCH_TIMEOUT_MS = 5_000

/**
 * TMDB image size variant fetched for brightness analysis.
 * w92 is sufficient: analysis downscales to LOGO_ANALYSIS_MAX_DIMENSION
 * (64px) anyway, so sampling reliability is unchanged while transfer
 * size drops ~5-10x vs w500. Display URLs elsewhere are untouched.
 */
const LOGO_ANALYSIS_IMAGE_SIZE = "w92"

/**
 * TTL for cached logo-darkness booleans (~30 days), matching the
 * retention the image fetch-cache entries previously had.
 */
const LOGO_DARKNESS_CACHE_TTL_SECONDS = 2_592_000

/**
 * Distinct KV key prefix for cached booleans so they can be
 * listed/monitored separately from incremental-cache fetch entries:
 * `wrangler kv key list --prefix=logo-dark/v1/`
 */
const LOGO_DARKNESS_CACHE_KEY_PREFIX = "logo-dark/v1/"

/**
 * Minimum opacity threshold to consider a pixel as "visible"
 * Logos often have transparent backgrounds, so we only analyze visible pixels
 */
const MIN_OPACITY_THRESHOLD = 128

/**
 * Analyze if a logo image is predominantly dark and near-monochrome.
 * If image analysis is unavailable, default to `false` so non-dark logos do not
 * receive the contrast glow by mistake.
 *
 * @param logoUrl - Full URL to the logo image
 * @returns true if the logo is dark, false otherwise
 */
export async function isLogoDark(logoUrl: string | null): Promise<boolean> {
  if (!logoUrl) {
    return false
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(logoUrl)
  } catch {
    return false
  }

  if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
    return false
  }

  // Analyze the smaller w92 variant; the caller's display URL is untouched.
  const analysisUrl = getAnalysisImageUrl(logoUrl)
  const cacheKey = await buildLogoDarknessCacheKey(analysisUrl)

  // Serve cached booleans even where pixel analysis is unavailable, so
  // runtimes without OffscreenCanvas still get correct glow styling once
  // any capable runtime has analyzed the logo.
  const cached = await readCachedLogoDarkness(cacheKey)
  if (cached !== null) {
    return cached
  }

  const hasImageAnalyzerRuntime =
    typeof fetch === "function" &&
    typeof createImageBitmap === "function" &&
    typeof OffscreenCanvas !== "undefined"

  if (!hasImageAnalyzerRuntime) {
    return false
  }

  const result = await analyzeLogoImage(analysisUrl)
  writeCachedLogoDarkness(cacheKey, result)
  return result
}

/**
 * Rewrite a logo URL to the smaller variant used for analysis.
 * Only TMDB image URLs carry a size segment that is safe to downscale;
 * all other hosts pass through unchanged.
 */
function getAnalysisImageUrl(logoUrl: string): string {
  let parsed: URL
  try {
    parsed = new URL(logoUrl)
  } catch {
    return logoUrl
  }

  if (parsed.hostname === "image.tmdb.org") {
    parsed.pathname = parsed.pathname.replace(
      /^\/t\/p\/[^/]+/,
      `/t/p/${LOGO_ANALYSIS_IMAGE_SIZE}`,
    )
  }

  return parsed.toString()
}

/** Minimal structural type for the KV binding (avoids worker-type imports). */
interface LogoDarknessKv {
  get(key: string, type: "text"): Promise<string | null>
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ): Promise<void>
}

async function getLogoDarknessKv(): Promise<LogoDarknessKv | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare")
    const context = await getCloudflareContext()
    const kv = (
      context?.env as unknown as
        | { NEXT_INC_CACHE_KV?: LogoDarknessKv }
        | undefined
    )?.NEXT_INC_CACHE_KV
    return kv ?? null
  } catch {
    // Local dev without bindings, build-time prerender, or unit tests.
    return null
  }
}

async function buildLogoDarknessCacheKey(
  analysisUrl: string,
): Promise<string> {
  try {
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(analysisUrl),
    )
    const hex = Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("")
    return `${LOGO_DARKNESS_CACHE_KEY_PREFIX}${hex}`
  } catch {
    const slug = analysisUrl.replace(/[^a-zA-Z0-9]/g, "").slice(-96)
    return `${LOGO_DARKNESS_CACHE_KEY_PREFIX}${slug}`
  }
}

async function readCachedLogoDarkness(
  cacheKey: string,
): Promise<boolean | null> {
  try {
    const kv = await getLogoDarknessKv()
    if (!kv) {
      return null
    }
    const stored = await kv.get(cacheKey, "text")
    if (stored === "1") {
      return true
    }
    if (stored === "0") {
      return false
    }
    return null
  } catch {
    return null
  }
}

function writeCachedLogoDarkness(cacheKey: string, value: boolean): void {
  // Fire-and-forget: a cache write must never fail the render.
  void (async () => {
    try {
      const kv = await getLogoDarknessKv()
      await kv?.put(cacheKey, value ? "1" : "0", {
        expirationTtl: LOGO_DARKNESS_CACHE_TTL_SECONDS,
      })
    } catch {
      // Best effort only.
    }
  })()
}

/**
 * Fetch an image and determine whether it is predominantly dark.
 * Uses `no-store` so raw image bytes never enter the KV fetch-cache;
 * the boolean result is cached separately (see readCachedLogoDarkness).
 */
async function analyzeLogoImage(analysisUrl: string): Promise<boolean> {
  let bitmap: ImageBitmap | null = null
  try {
    const response = await fetch(analysisUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(LOGO_FETCH_TIMEOUT_MS),
    })

    if (!response.ok) {
      return false
    }

    const contentType = response.headers.get("content-type") ?? ""
    if (!contentType.startsWith("image/")) {
      return false
    }

    const blob = await response.blob()
    bitmap = await createImageBitmap(blob)

    if (bitmap.width <= 0 || bitmap.height <= 0) {
      return false
    }

    const analysisScale = Math.min(
      1,
      LOGO_ANALYSIS_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height),
    )
    const analysisWidth = Math.max(1, Math.round(bitmap.width * analysisScale))
    const analysisHeight = Math.max(
      1,
      Math.round(bitmap.height * analysisScale),
    )
    const canvas = new OffscreenCanvas(analysisWidth, analysisHeight)
    const context = canvas.getContext("2d", { willReadFrequently: true })

    if (!context) {
      return false
    }

    context.drawImage(
      bitmap,
      0,
      0,
      bitmap.width,
      bitmap.height,
      0,
      0,
      analysisWidth,
      analysisHeight,
    )

    const { data } = context.getImageData(0, 0, analysisWidth, analysisHeight)
    let darkPixels = 0
    let visiblePixels = 0

    // Sample every fourth pixel to reduce analysis cost on larger logos.
    const pixelStride = 16
    for (let index = 0; index < data.length; index += pixelStride) {
      const alpha = data[index + 3] ?? 0
      if (alpha < MIN_OPACITY_THRESHOLD) {
        continue
      }

      visiblePixels += 1
      const red = data[index] ?? 0
      const green = data[index + 1] ?? 0
      const blue = data[index + 2] ?? 0
      if (isDarkNeutralPixel(red, green, blue)) {
        darkPixels += 1
      }
    }

    if (visiblePixels === 0) {
      return false
    }

    return darkPixels / visiblePixels >= 0.5
  } catch {
    return false
  } finally {
    bitmap?.close()
  }
}

/**
 * Enrich an array of HeroMedia items with logo brightness analysis
 * Analyzes unique logos with bounded concurrency to limit memory pressure
 *
 * @param mediaList - Array of HeroMedia items to enrich
 * @returns Same array with isDarkLogo field populated
 */
export async function enrichHeroMediaWithBrightness<
  T extends { logoUrl: string | null; isDarkLogo: boolean },
>(mediaList: T[]): Promise<T[]> {
  const brightnessByLogoUrl = new Map<string | null, boolean>()
  const uniqueLogoUrls = Array.from(
    new Set(mediaList.map((media) => media.logoUrl)),
  )

  await runWithConcurrencyLimit(
    uniqueLogoUrls,
    LOGO_ANALYSIS_CONCURRENCY,
    async (logoUrl) => {
      brightnessByLogoUrl.set(logoUrl, await isLogoDark(logoUrl))
    },
  )

  return mediaList.map((media) => ({
    ...media,
    isDarkLogo: brightnessByLogoUrl.get(media.logoUrl) ?? false,
  }))
}

function isDarkNeutralPixel(red: number, green: number, blue: number): boolean {
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue

  if (luminance >= DARK_LUMINANCE_THRESHOLD) {
    return false
  }

  const maxChannel = Math.max(red, green, blue)
  const minChannel = Math.min(red, green, blue)

  if (maxChannel === 0) {
    return true
  }

  return (
    (maxChannel - minChannel) / maxChannel <=
    DARK_NEUTRAL_SATURATION_THRESHOLD
  )
}

async function runWithConcurrencyLimit<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  if (items.length === 0) {
    return
  }

  let nextIndex = 0
  const runnerCount = Math.min(concurrency, items.length)

  async function runNext(): Promise<void> {
    if (nextIndex >= items.length) {
      return
    }

    const item = items[nextIndex] as T
    nextIndex += 1
    await worker(item)
    await runNext()
  }

  await Promise.all(
    Array.from({ length: runnerCount }, () => runNext()),
  )
}
