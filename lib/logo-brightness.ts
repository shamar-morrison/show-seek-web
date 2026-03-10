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

  const hasImageAnalyzerRuntime =
    typeof fetch === "function" &&
    typeof createImageBitmap === "function" &&
    typeof OffscreenCanvas !== "undefined"

  if (!hasImageAnalyzerRuntime) {
    return false
  }

  let bitmap: ImageBitmap | null = null
  try {
    const response = await fetch(parsedUrl.toString(), { cache: "force-cache" })

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
