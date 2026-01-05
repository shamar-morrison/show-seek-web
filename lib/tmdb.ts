/**
 * TMDB API Utility Functions
 * Server-side functions for fetching trending media and images
 */

import type {
  HeroMedia,
  TMDBConfiguration,
  TMDBImagesResponse,
  TMDBMedia,
  TMDBMovieDetails,
  TMDBPersonDetails,
  TMDBSearchResponse,
  TMDBTrendingResponse,
  TMDBTVDetails,
  TMDBVideosResponse,
  WatchProviders,
  WatchProvidersResponse,
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
 * Fetch popular movies
 * @returns Array of popular movies
 */
export async function getPopularMovies(): Promise<TMDBMedia[]> {
  if (!TMDB_API_KEY) return []

  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/movie/popular?api_key=${TMDB_API_KEY}`,
      { next: { revalidate: 3600 } },
    )

    if (!response.ok) throw new Error(`TMDB API error: ${response.status}`)

    const data: TMDBTrendingResponse = await response.json()
    // Inject media_type since it's not returned by specific endpoints
    return data.results.map((item) => ({ ...item, media_type: "movie" }))
  } catch (error) {
    console.error("Failed to fetch popular movies:", error)
    return []
  }
}

/**
 * Fetch top rated TV shows
 * @returns Array of top rated TV shows
 */
export async function getTopRatedTV(): Promise<TMDBMedia[]> {
  if (!TMDB_API_KEY) return []

  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/tv/top_rated?api_key=${TMDB_API_KEY}`,
      { next: { revalidate: 3600 } },
    )

    if (!response.ok) throw new Error(`TMDB API error: ${response.status}`)

    const data: TMDBTrendingResponse = await response.json()
    return data.results.map((item) => ({ ...item, media_type: "tv" }))
  } catch (error) {
    console.error("Failed to fetch top rated TV:", error)
    return []
  }
}

/**
 * Fetch upcoming movies
 * @returns Array of upcoming movies
 */
export async function getUpcomingMovies(): Promise<TMDBMedia[]> {
  if (!TMDB_API_KEY) return []

  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/movie/upcoming?api_key=${TMDB_API_KEY}`,
      { next: { revalidate: 3600 } },
    )

    if (!response.ok) throw new Error(`TMDB API error: ${response.status}`)

    const data: TMDBTrendingResponse = await response.json()
    return data.results.map((item) => ({ ...item, media_type: "movie" }))
  } catch (error) {
    console.error("Failed to fetch upcoming movies:", error)
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
      { next: { revalidate: 2592000 } }, // Cache for 30 days
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
 * Fetch videos/trailers for a specific media item
 * @param mediaId - TMDB media ID
 * @param mediaType - "movie" or "tv"
 * @returns Videos response with trailers, teasers, etc.
 */
export async function getMediaVideos(
  mediaId: number,
  mediaType: "movie" | "tv",
): Promise<TMDBVideosResponse | null> {
  if (!TMDB_API_KEY) {
    console.error("TMDB_API_KEY is not set")
    return null
  }

  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/${mediaType}/${mediaId}/videos?api_key=${TMDB_API_KEY}`,
      { next: { revalidate: 86400 } }, // Cache for 24 hours
    )

    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status}`)
    }

    return response.json()
  } catch (error) {
    console.error("Failed to fetch media videos:", error)
    return null
  }
}

/**
 * Get the best available trailer for a media item
 * Prioritizes official trailers from YouTube
 * @param videos - Videos response from TMDB
 * @returns YouTube video key or null
 */
export function getBestTrailer(
  videos: TMDBVideosResponse | null,
): string | null {
  if (!videos || !videos.results || videos.results.length === 0) {
    return null
  }

  // Filter for YouTube videos only
  const youtubeVideos = videos.results.filter(
    (video) => video.site === "YouTube" && video.key,
  )

  if (youtubeVideos.length === 0) {
    return null
  }

  // Priority 1: Official trailer
  const officialTrailer = youtubeVideos.find(
    (video) => video.type === "Trailer" && video.official === true,
  )
  if (officialTrailer) {
    return officialTrailer.key
  }

  // Priority 2: Any trailer (official or not)
  const anyTrailer = youtubeVideos.find((video) => video.type === "Trailer")
  if (anyTrailer) {
    return anyTrailer.key
  }

  // Priority 3: Official teaser
  const officialTeaser = youtubeVideos.find(
    (video) => video.type === "Teaser" && video.official === true,
  )
  if (officialTeaser) {
    return officialTeaser.key
  }

  // Priority 4: Any teaser
  const anyTeaser = youtubeVideos.find((video) => video.type === "Teaser")
  if (anyTeaser) {
    return anyTeaser.key
  }

  // Fallback: first YouTube video
  return youtubeVideos[0]?.key || null
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

    // Fetch logo images and videos for the featured media in parallel
    const mediaType = featuredMedia.media_type as "movie" | "tv"
    const [images, videos] = await Promise.all([
      getMediaImages(featuredMedia.id, mediaType),
      getMediaVideos(featuredMedia.id, mediaType),
    ])
    const logoUrl = getBestLogo(images)
    const trailerKey = getBestTrailer(videos)

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
      trailerKey,
    }

    return heroMedia
  } catch (error) {
    console.error("Failed to get hero media:", error)
    return null
  }
}

/**
 * Get multiple hero media items for carousel/slideshow
 * Fetches top trending media items with logos in parallel
 * @param count - Number of items to return (default: 5)
 * @returns Array of HeroMedia objects ready for UI consumption
 */
export async function getHeroMediaList(
  count: number = 5,
): Promise<HeroMedia[]> {
  try {
    // Fetch trending media
    const trendingMedia = await getTrendingMedia("day")

    if (trendingMedia.length === 0) {
      console.error("No trending media found")
      return []
    }

    // Filter items with backdrops and take top N
    const mediaWithBackdrops = trendingMedia
      .filter((media) => media.backdrop_path)
      .slice(0, count)

    if (mediaWithBackdrops.length === 0) {
      console.error("No media with backdrop found")
      return []
    }

    // Fetch logos and trailers for all items in parallel
    const heroMediaPromises = mediaWithBackdrops.map(async (media) => {
      const mediaType = media.media_type as "movie" | "tv"
      const [images, videos] = await Promise.all([
        getMediaImages(media.id, mediaType),
        getMediaVideos(media.id, mediaType),
      ])
      const logoUrl = getBestLogo(images)
      const trailerKey = getBestTrailer(videos)

      const heroMedia: HeroMedia = {
        id: media.id,
        title: media.title || media.name || "Unknown Title",
        overview: media.overview || "No description available.",
        backdropUrl: buildImageUrl(media.backdrop_path, "original") || "",
        logoUrl,
        mediaType,
        releaseYear: extractYear(media.release_date || media.first_air_date),
        voteAverage: Math.round(media.vote_average * 10) / 10,
        trailerKey,
      }

      return heroMedia
    })

    const heroMediaList = await Promise.all(heroMediaPromises)
    return heroMediaList
  } catch (error) {
    console.error("Failed to get hero media list:", error)
    return []
  }
}

/**
 * Fetch full movie details including credits
 * @param movieId - TMDB movie ID
 * @returns Movie details with credits or null
 */
export async function getMovieDetails(
  movieId: number,
): Promise<TMDBMovieDetails | null> {
  if (!TMDB_API_KEY) {
    console.error("TMDB_API_KEY is not set")
    return null
  }

  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/movie/${movieId}?api_key=${TMDB_API_KEY}&append_to_response=credits`,
      { next: { revalidate: 3600 } }, // Cache for 1 hour
    )

    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status}`)
    }

    return response.json()
  } catch (error) {
    console.error("Failed to fetch movie details:", error)
    return null
  }
}

/**
 * Fetch full TV show details including credits
 * @param tvId - TMDB TV show ID
 * @returns TV show details with credits or null
 */
export async function getTVDetails(
  tvId: number,
): Promise<TMDBTVDetails | null> {
  if (!TMDB_API_KEY) {
    console.error("TMDB_API_KEY is not set")
    return null
  }

  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/tv/${tvId}?api_key=${TMDB_API_KEY}&append_to_response=credits`,
      { next: { revalidate: 3600 } }, // Cache for 1 hour
    )

    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status}`)
    }

    return response.json()
  } catch (error) {
    console.error("Failed to fetch TV details:", error)
    return null
  }
}

/**
 * Multi-search across movies, TV shows, and people
 * @param query - Search query string
 * @param page - Page number (default: 1)
 * @returns Search response with results
 */
export async function multiSearch(
  query: string,
  page: number = 1,
): Promise<TMDBSearchResponse> {
  if (!TMDB_API_KEY || !query.trim()) {
    return { page: 1, results: [], total_pages: 0, total_results: 0 }
  }

  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&page=${page}&include_adult=false`,
      { next: { revalidate: 300 } }, // Cache for 5 minutes
    )

    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status}`)
    }

    return response.json()
  } catch (error) {
    console.error("Failed to perform multi-search:", error)
    return { page: 1, results: [], total_pages: 0, total_results: 0 }
  }
}

/**
 * Fetch full person details including combined credits
 * @param personId - TMDB person ID
 * @returns Person details with combined credits or null
 */
export async function getPersonDetails(
  personId: number,
): Promise<TMDBPersonDetails | null> {
  if (!TMDB_API_KEY) {
    console.error("TMDB_API_KEY is not set")
    return null
  }

  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/person/${personId}?api_key=${TMDB_API_KEY}&append_to_response=combined_credits`,
      { next: { revalidate: 3600 } }, // Cache for 1 hour
    )

    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status}`)
    }

    return response.json()
  } catch (error) {
    console.error("Failed to fetch person details:", error)
    return null
  }
}

/**
 * Fetch watch providers for a movie or TV show
 * @param mediaId - TMDB media ID
 * @param mediaType - "movie" or "tv"
 * @param region - Country code for providers (default: "US")
 * @returns Watch providers for the specified region or null if unavailable
 */
export async function getWatchProviders(
  mediaId: number,
  mediaType: "movie" | "tv",
  region: string = "US",
): Promise<WatchProviders | null> {
  if (!TMDB_API_KEY) {
    console.error("TMDB_API_KEY is not set")
    return null
  }

  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/${mediaType}/${mediaId}/watch/providers?api_key=${TMDB_API_KEY}`,
      { next: { revalidate: 86400 } }, // Cache for 24 hours
    )

    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status}`)
    }

    const data: WatchProvidersResponse = await response.json()

    // Return providers for the specified region, or null if not available
    return data.results[region] || null
  } catch (error) {
    console.error("Failed to fetch watch providers:", error)
    return null
  }
}

/**
 * Fetch similar movies or TV shows
 * @param mediaId - TMDB media ID
 * @param mediaType - "movie" or "tv"
 * @returns Array of similar media items
 */
export async function getSimilarMedia(
  mediaId: number,
  mediaType: "movie" | "tv",
): Promise<TMDBMedia[]> {
  if (!TMDB_API_KEY) {
    console.error("TMDB_API_KEY is not set")
    return []
  }

  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/${mediaType}/${mediaId}/similar?api_key=${TMDB_API_KEY}`,
      { next: { revalidate: 3600 } }, // Cache for 1 hour
    )

    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status}`)
    }

    const data: TMDBTrendingResponse = await response.json()
    // Inject media_type since similar endpoint doesn't return it
    return data.results.map((item) => ({ ...item, media_type: mediaType }))
  } catch (error) {
    console.error("Failed to fetch similar media:", error)
    return []
  }
}

/**
 * Fetch recommended movies or TV shows
 * @param mediaId - TMDB media ID
 * @param mediaType - "movie" or "tv"
 * @returns Array of recommended media items
 */
export async function getRecommendations(
  mediaId: number,
  mediaType: "movie" | "tv",
): Promise<TMDBMedia[]> {
  if (!TMDB_API_KEY) {
    console.error("TMDB_API_KEY is not set")
    return []
  }

  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/${mediaType}/${mediaId}/recommendations?api_key=${TMDB_API_KEY}`,
      { next: { revalidate: 3600 } }, // Cache for 1 hour
    )

    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status}`)
    }

    const data: TMDBTrendingResponse = await response.json()
    // Inject media_type since recommendations endpoint doesn't return it
    return data.results.map((item) => ({ ...item, media_type: mediaType }))
  } catch (error) {
    console.error("Failed to fetch recommendations:", error)
    return []
  }
}
