/**
 * Logo Brightness Analysis Utility
 * Analyzes logo images to determine if they are predominantly dark
 * Used server-side during data fetching for zero client-side overhead
 */

import "server-only"

/**
 * Luminance threshold below which a logo is considered "dark"
 * Range: 0-255, where 0 is black and 255 is white
 * A threshold of 80 catches most dark/black logos while excluding gray ones
 */
const DARK_LUMINANCE_THRESHOLD = 80

/**
 * Minimum opacity threshold to consider a pixel as "visible"
 * Logos often have transparent backgrounds, so we only analyze visible pixels
 */
const MIN_OPACITY_THRESHOLD = 128

/**
 * Analyze if a logo image is predominantly dark
 * Cloudflare Workers cannot run the previous sharp-based implementation.
 * We conservatively fall back to `true` so visibility safeguards still apply.
 *
 * @param logoUrl - Full URL to the logo image
 * @returns true if the logo is dark, false otherwise
 */
export async function isLogoDark(logoUrl: string | null): Promise<boolean> {
  if (!logoUrl) {
    return true
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(logoUrl)
  } catch {
    return true
  }

  if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
    return true
  }

  const hasImageAnalyzerRuntime =
    typeof fetch === "function" &&
    typeof createImageBitmap === "function" &&
    typeof OffscreenCanvas !== "undefined"

  if (!hasImageAnalyzerRuntime) {
    return true
  }

  let bitmap: ImageBitmap | null = null
  try {
    const response = await fetch(parsedUrl.toString(), { cache: "force-cache" })

    if (!response.ok) {
      return true
    }

    const contentType = response.headers.get("content-type") ?? ""
    if (!contentType.startsWith("image/")) {
      return true
    }

    const blob = await response.blob()
    bitmap = await createImageBitmap(blob)

    if (bitmap.width <= 0 || bitmap.height <= 0) {
      return true
    }

    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const context = canvas.getContext("2d", { willReadFrequently: true })

    if (!context) {
      return true
    }

    context.drawImage(bitmap, 0, 0)

    const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height)
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
      const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue

      if (luminance < DARK_LUMINANCE_THRESHOLD) {
        darkPixels += 1
      }
    }

    if (visiblePixels === 0) {
      return true
    }

    return darkPixels / visiblePixels >= 0.5
  } catch {
    return true
  } finally {
    bitmap?.close()
  }
}

/**
 * Enrich an array of HeroMedia items with logo brightness analysis
 * Analyzes all logos in parallel for efficiency
 *
 * @param mediaList - Array of HeroMedia items to enrich
 * @returns Same array with isDarkLogo field populated
 */
export async function enrichHeroMediaWithBrightness<
  T extends { logoUrl: string | null; isDarkLogo: boolean },
>(mediaList: T[]): Promise<T[]> {
  const results = await Promise.all(
    mediaList.map(async (media) => ({
      ...media,
      isDarkLogo: await isLogoDark(media.logoUrl),
    })),
  )
  return results
}
