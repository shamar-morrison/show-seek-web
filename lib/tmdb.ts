/**
 * TMDB API Utility Functions
 * Server-side functions for fetching trending media and images
 */

import type {
  TMDBConfiguration,
  TMDBMedia,
  TMDBTrendingResponse,
  TMDBImagesResponse,
  HeroMedia,
} from "@/types/tmdb"

const TMDB_API_KEY = process.env.TMDB_API_KEY
const TMDB_BASE_URL = "https://api.themoviedb.org/3"

/** Default image base URL as fallback */
const DEFAULT_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/"

/**
 * Fetch TMDB API configuration including image base URLs
 * @returns Configuration object with image URLs
 */
export async function getTMDBConfiguration(): Promise<TMDBConfiguration | null> {
  if (!TMDB_API_KEY) {
    console.error("TMDB_API_KEY is not set")
    return null
  }

  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/configuration?api_key=${TMDB_API_KEY}`,
      { next: { revalidate: 86400 } }, // Cache for 24 hours
    )

    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status}`)
    }

    return response.json()
  } catch (error) {
    console.error("Failed to fetch TMDB configuration:", error)
    return null
  }
}

/**
 * Fetch trending movies and TV shows
 * @param timeWindow - "day" or "week"
 * @returns Array of trending media items
 */
export async function getTrendingMedia(
  timeWindow: "day" | "week" = "day",
): Promise<TMDBMedia[]> {
  if (!TMDB_API_KEY) {
    console.error("TMDB_API_KEY is not set")
    return []
  }

  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/trending/all/${timeWindow}?api_key=${TMDB_API_KEY}`,
      { next: { revalidate: 3600 } }, // Cache for 1 hour
    )

    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status}`)
    }

    const data: TMDBTrendingResponse = await response.json()
    // Filter out "person" type as we only want movies/shows
    return data.results.filter((item) => item.media_type !== "person")
  } catch (error) {
    console.error("Failed to fetch trending media:", error)
    return []
  }
}

/**
 * Fetch images (including logos) for a specific media item
 * @param mediaId - TMDB media ID
 * @param mediaType - "movie" or "tv"
 * @returns Images response with logos, backdrops, posters
 */
export async function getMediaImages(
  mediaId: number,
  mediaType: "movie" | "tv",
): Promise<TMDBImagesResponse | null> {
  if (!TMDB_API_KEY) {
    console.error("TMDB_API_KEY is not set")
    return null
  }

  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/${mediaType}/${mediaId}/images?api_key=${TMDB_API_KEY}`,
      { next: { revalidate: 86400 } }, // Cache for 24 hours
    )

    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status}`)
    }

    return response.json()
  } catch (error) {
    console.error("Failed to fetch media images:", error)
    return null
  }
}

/**
 * Build full image URL from TMDB path
 * @param path - Image path from TMDB
 * @param size - Size variant (e.g., "original", "w500", "w780")
 * @returns Full image URL
 */
export function buildImageUrl(
  path: string | null,
  size: string = "original",
): string | null {
  if (!path) return null
  return `${DEFAULT_IMAGE_BASE_URL}${size}${path}`
}

/**
 * Get the best available logo for a media item
 * Prioritizes English logos, then falls back to others
 * @param images - Images response from TMDB
 * @returns Logo URL or null
 */
function getBestLogo(images: TMDBImagesResponse | null): string | null {
  if (!images || !images.logos || images.logos.length === 0) {
    return null
  }

  // Prefer English logos
  const englishLogo = images.logos.find(
    (logo) => logo.iso_639_1 === "en" && logo.file_path,
  )
  if (englishLogo) {
    return buildImageUrl(englishLogo.file_path, "w500")
  }

  // Fall back to any logo with null language (often universal)
  const universalLogo = images.logos.find(
    (logo) => logo.iso_639_1 === null && logo.file_path,
  )
  if (universalLogo) {
    return buildImageUrl(universalLogo.file_path, "w500")
  }

  // Fall back to the first available logo
  const firstLogo = images.logos[0]
  return firstLogo ? buildImageUrl(firstLogo.file_path, "w500") : null
}

/**
 * Extract release year from date string
 * @param dateString - Date in YYYY-MM-DD format
 * @returns Year string or null
 */
function extractYear(dateString?: string): string | null {
  if (!dateString) return null
  return dateString.split("-")[0] || null
}

/**
 * Get processed hero media data for the home page
 * Fetches trending media and enriches with logo if available
 * @returns HeroMedia object ready for UI consumption
 */
export async function getHeroMedia(): Promise<HeroMedia | null> {
  try {
    // Fetch trending media
    const trendingMedia = await getTrendingMedia("day")

    if (trendingMedia.length === 0) {
      console.error("No trending media found")
      return null
    }

    // Get the first trending item with a backdrop
    const featuredMedia = trendingMedia.find((media) => media.backdrop_path)

    if (!featuredMedia) {
      console.error("No media with backdrop found")
      return null
    }

    // Fetch logo images for the featured media
    const mediaType = featuredMedia.media_type as "movie" | "tv"
    const images = await getMediaImages(featuredMedia.id, mediaType)
    const logoUrl = getBestLogo(images)

    // Build the hero media object
    const heroMedia: HeroMedia = {
      id: featuredMedia.id,
      title: featuredMedia.title || featuredMedia.name || "Unknown Title",
      overview: featuredMedia.overview || "No description available.",
      backdropUrl: buildImageUrl(featuredMedia.backdrop_path, "original") || "",
      logoUrl,
      mediaType,
      releaseYear: extractYear(
        featuredMedia.release_date || featuredMedia.first_air_date,
      ),
      voteAverage: Math.round(featuredMedia.vote_average * 10) / 10,
    }

    return heroMedia
  } catch (error) {
    console.error("Failed to get hero media:", error)
    return null
  }
}
