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
const DARK_LUMINANCE_THRESHOLD = 100

/**
 * Minimum opacity threshold to consider a pixel as "visible"
 * Logos often have transparent backgrounds, so we only analyze visible pixels
 */
const MIN_OPACITY_THRESHOLD = 128

/**
 * Analyze if a logo image is predominantly dark
 * Fetches the image and samples pixels to calculate average luminance
 * Uses dynamic import of sharp to avoid bundling issues on Vercel
 *
 * @param logoUrl - Full URL to the logo image
 * @returns true if the logo is dark, false otherwise
 */
export async function isLogoDark(logoUrl: string | null): Promise<boolean> {
  if (!logoUrl) return false

  try {
    // Fetch the image as a buffer
    const response = await fetch(logoUrl, {
      next: { revalidate: 2592000 }, // Cache for 30 days (same as images)
    })

    if (!response.ok) {
      console.warn(`Failed to fetch logo for brightness analysis: ${logoUrl}`)
      return false
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Dynamic import of sharp to avoid bundling issues
    // This works because Next.js includes sharp for image optimization
    let sharpModule
    try {
      sharpModule = await import("sharp")
    } catch {
      console.warn("Sharp not available for logo brightness analysis")
      return false
    }

    const sharp = sharpModule.default

    const { data } = await sharp(buffer)
      .resize(50, 50, { fit: "inside" }) // Resize for faster analysis
      .ensureAlpha() // Ensure 4 channels (RGBA)
      .raw()
      .toBuffer({ resolveWithObject: true })

    // Sample pixels and calculate average luminance
    let totalLuminance = 0
    let visiblePixelCount = 0

    // Each pixel is 4 bytes: R, G, B, A
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const a = data[i + 3]

      // Only consider pixels that are sufficiently opaque
      if (a >= MIN_OPACITY_THRESHOLD) {
        // Calculate perceived luminance using ITU-R BT.709 coefficients
        const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
        totalLuminance += luminance
        visiblePixelCount++
      }
    }

    // If no visible pixels, consider it not dark
    if (visiblePixelCount === 0) return false

    const averageLuminance = totalLuminance / visiblePixelCount
    return averageLuminance < DARK_LUMINANCE_THRESHOLD
  } catch (error) {
    console.warn("Error analyzing logo brightness:", error)
    return false
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
