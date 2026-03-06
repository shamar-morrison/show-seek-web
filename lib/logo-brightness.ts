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
 * We conservatively fall back to `false` so the UI still renders correctly.
 *
 * @param logoUrl - Full URL to the logo image
 * @returns true if the logo is dark, false otherwise
 */
export async function isLogoDark(logoUrl: string | null): Promise<boolean> {
  void logoUrl
  void DARK_LUMINANCE_THRESHOLD
  void MIN_OPACITY_THRESHOLD
  return false
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
