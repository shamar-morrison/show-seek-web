/**
 * TMDB API Utility Functions
 * Server-side functions for fetching trending media and images
 */

import type {
  DiscoverParams,
  Genre,
  HeroMedia,
  TMDBCollectionDetails,
  TMDBConfiguration,
  TMDBDiscoverResponse,
  TMDBEpisodeDetails,
  TMDBGenreListResponse,
  TMDBImagesResponse,
  TMDBLanguage,
  TMDBMedia,
  TMDBMovieDetails,
  TMDBPersonDetails,
  TMDBReviewsResponse,
  TMDBSearchResponse,
  TMDBTrendingResponse,
  TMDBTVDetails,
  TMDBVideosResponse,
  TMDBWatchProviderListResponse,
  TMDBWatchProviderOption,
  WatchProviders,
  WatchProvidersResponse,
} from "@/types/tmdb"

const TMDB_API_KEY = process.env.TMDB_API_KEY
const TMDB_BASE_URL = "https://api.themoviedb.org/3"

/** Default image base URL as fallback */
const DEFAULT_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/"

/** Bearer token for TMDB API authentication (preferred over api_key query param) */
const TMDB_BEARER_TOKEN = process.env.TMDB_BEARER_TOKEN || TMDB_API_KEY

/**
 * Build standard headers for TMDB API requests
 * Uses Bearer token authentication instead of query parameters
 * @throws Error if TMDB_BEARER_TOKEN is not configured
 */
function buildTmdbHeaders(): HeadersInit {
  if (
    !TMDB_BEARER_TOKEN ||
    typeof TMDB_BEARER_TOKEN !== "string" ||
    TMDB_BEARER_TOKEN.trim() === ""
  ) {
    throw new Error(
      "TMDB API credentials not configured. Set TMDB_BEARER_TOKEN or TMDB_API_KEY environment variable.",
    )
  }

  return {
    Authorization: `Bearer ${TMDB_BEARER_TOKEN}`,
    "Content-Type": "application/json",
  }
}

/**
 * Centralized fetch wrapper for TMDB API calls
 * Uses Authorization header instead of api_key query parameter
 * @param endpoint - API endpoint path (e.g., "/movie/popular")
 * @param options - Additional fetch options (cache settings, etc.)
 * @param queryParams - Optional query parameters (excluding api_key)
 * @returns Fetch Response
 */
export async function tmdbFetch(
  endpoint: string,
  options?: RequestInit & { next?: { revalidate?: number } },
  queryParams?: Record<string, string>,
): Promise<Response> {
  const url = new URL(`${TMDB_BASE_URL}${endpoint}`)

  if (queryParams) {
    Object.entries(queryParams).forEach(([key, value]) => {
      url.searchParams.set(key, value)
    })
  }

  return fetch(url.toString(), {
    ...options,
    headers: {
      ...buildTmdbHeaders(),
      ...options?.headers,
    },
  })
}

/**
 * Fetch TMDB API configuration including image base URLs
 * @returns Configuration object with image URLs
 */
export async function getTMDBConfiguration(): Promise<TMDBConfiguration | null> {
  if (!TMDB_BEARER_TOKEN) {
    console.error("TMDB API credentials not set")
    return null
  }

  try {
    const response = await tmdbFetch("/configuration", {
      next: { revalidate: 86400 },
    }) // Cache for 24 hours

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
  if (!TMDB_BEARER_TOKEN) {
    console.error("TMDB API credentials not set")
    return []
  }

  try {
    const response = await tmdbFetch(`/trending/all/${timeWindow}`, {
      next: { revalidate: 3600 },
    }) // Cache for 1 hour

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
 * Helper function to fetch a list of media items from a specific endpoint
 * @param endpoint - API endpoint path (e.g., "/movie/popular")
 * @param mediaType - "movie" or "tv" to inject into results
 * @param errorMessage - Error message to log on failure
 * @returns Array of media items with injected media_type
 */
async function fetchMediaList(
  endpoint: string,
  mediaType: "movie" | "tv",
  errorMessage: string,
): Promise<TMDBMedia[]> {
  if (!TMDB_BEARER_TOKEN) return []

  try {
    const response = await tmdbFetch(endpoint, { next: { revalidate: 3600 } })

    if (!response.ok) throw new Error(`TMDB API error: ${response.status}`)

    const data: TMDBTrendingResponse = await response.json()
    return data.results.map((item) => ({ ...item, media_type: mediaType }))
  } catch (error) {
    console.error(errorMessage, error)
    return []
  }
}
/**
 * Fetch popular movies
 * @returns Array of popular movies
 */
export async function getPopularMovies(): Promise<TMDBMedia[]> {
  return fetchMediaList(
    "/movie/popular",
    "movie",
    "Failed to fetch popular movies:",
  )
}

/**
 * Fetch top rated TV shows
 * @returns Array of top rated TV shows
 */
export async function getTopRatedTV(): Promise<TMDBMedia[]> {
  return fetchMediaList("/tv/top_rated", "tv", "Failed to fetch top rated TV:")
}

/**
 * Fetch upcoming movies
 * @returns Array of upcoming movies
 */
export async function getUpcomingMovies(): Promise<TMDBMedia[]> {
  return fetchMediaList(
    "/movie/upcoming",
    "movie",
    "Failed to fetch upcoming movies:",
  )
}

/** Trailer item with media info and YouTube key */
export interface TrailerItem {
  id: number
  title: string
  mediaType: "movie" | "tv"
  posterPath: string | null
  backdropPath: string | null
  trailerKey: string
  releaseYear: string | null
}

/**
 * Get latest trailers from trending media
 * Fetches trending items and enriches with trailer keys
 * @param count - Number of trailers to return (default: 10)
 * @returns Array of TrailerItem objects with YouTube keys
 */
export async function getLatestTrailers(
  count: number = 10,
): Promise<TrailerItem[]> {
  try {
    // Fetch trending media
    const trendingMedia = await getTrendingMedia("day")

    if (trendingMedia.length === 0) {
      return []
    }

    // Take more items than needed to account for items without trailers
    const candidates = trendingMedia.slice(0, count * 2)

    // Fetch trailers for all candidates in parallel
    const trailersPromises = candidates.map(async (media) => {
      const mediaType = media.media_type as "movie" | "tv"
      const videos = await getMediaVideos(media.id, mediaType)
      const trailerKey = getBestTrailer(videos)

      if (!trailerKey) return null

      const item: TrailerItem = {
        id: media.id,
        title: media.title || media.name || "Unknown",
        mediaType,
        posterPath: media.poster_path,
        backdropPath: media.backdrop_path,
        trailerKey,
        releaseYear:
          media.release_date?.split("-")[0] ||
          media.first_air_date?.split("-")[0] ||
          null,
      }

      return item
    })

    const results = await Promise.all(trailersPromises)

    // Filter out nulls and limit to requested count
    return results
      .filter((item): item is TrailerItem => item !== null)
      .slice(0, count)
  } catch (error) {
    console.error("Failed to get latest trailers:", error)
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
  if (!TMDB_BEARER_TOKEN) {
    console.error("TMDB API credentials not set")
    return null
  }

  try {
    const response = await tmdbFetch(`/${mediaType}/${mediaId}/images`, {
      next: { revalidate: 2592000 },
    }) // Cache for 30 days

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
 * Build avatar URL for TMDB review authors
 * Handles both full URLs (starting with /http) and TMDB paths
 * @param avatarPath - Avatar path from TMDB review author_details
 * @returns Avatar URL or null
 */
export function buildAvatarUrl(avatarPath: string | null): string | null {
  if (!avatarPath) return null

  // If it starts with /http, it's a full URL (remove leading slash)
  if (avatarPath.startsWith("/http")) {
    return avatarPath.substring(1)
  }

  // Otherwise, build TMDB image URL
  return buildImageUrl(avatarPath, "w185")
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
  if (!TMDB_BEARER_TOKEN) {
    console.error("TMDB API credentials not set")
    return null
  }

  try {
    const response = await tmdbFetch(`/${mediaType}/${mediaId}/videos`, {
      next: { revalidate: 86400 },
    }) // Cache for 24 hours

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
  if (!TMDB_BEARER_TOKEN) {
    console.error("TMDB API credentials not set")
    return null
  }

  try {
    const response = await tmdbFetch(
      `/movie/${movieId}`,
      { next: { revalidate: 3600 } },
      { append_to_response: "credits,release_dates" },
    ) // Cache for 1 hour

    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status}`)
    }

    return response.json()
  } catch (error) {
    // 404 is expected for deleted/invalid media - don't log
    if (error instanceof Error && error.message.includes("404")) {
      return null
    }
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
  if (!TMDB_BEARER_TOKEN) {
    console.error("TMDB API credentials not set")
    return null
  }

  try {
    const response = await tmdbFetch(
      `/tv/${tvId}`,
      { next: { revalidate: 3600 } },
      { append_to_response: "credits,content_ratings" },
    ) // Cache for 1 hour

    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status}`)
    }

    return response.json()
  } catch (error) {
    // 404 is expected for deleted/invalid media - don't log
    if (error instanceof Error && error.message.includes("404")) {
      return null
    }
    console.error("Failed to fetch TV details:", error)
    return null
  }
}

/** Season episode data for progress tracking */
export interface TMDBSeasonEpisode {
  id: number
  episode_number: number
  name: string
  overview: string
  air_date: string | null
  runtime: number | null
  still_path: string | null
  vote_average: number
  vote_count: number
  season_number: number
}

/** Season details response */
export interface TMDBSeasonDetails {
  id: number
  season_number: number
  name: string
  overview: string
  poster_path: string | null
  air_date: string | null
  vote_average: number
  episodes: TMDBSeasonEpisode[]
}

/**
 * Fetch season details including episodes
 * @param tvId - TMDB TV show ID
 * @param seasonNumber - Season number
 * @returns Season details with episodes or null
 */
export async function getSeasonDetails(
  tvId: number,
  seasonNumber: number,
): Promise<TMDBSeasonDetails | null> {
  if (!TMDB_BEARER_TOKEN) {
    console.error("TMDB API credentials not set")
    return null
  }

  try {
    const response = await tmdbFetch(`/tv/${tvId}/season/${seasonNumber}`, {
      next: { revalidate: 3600 },
    }) // Cache for 1 hour

    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status}`)
    }

    const data = await response.json()

    // Return full season and episode data
    return {
      id: data.id,
      season_number: data.season_number,
      name: data.name || `Season ${data.season_number}`,
      overview: data.overview || "",
      poster_path: data.poster_path || null,
      air_date: data.air_date || null,
      vote_average: data.vote_average || 0,
      episodes:
        data.episodes?.map(
          (ep: {
            id: number
            episode_number: number
            name: string
            overview: string
            air_date: string | null
            runtime: number | null
            still_path: string | null
            vote_average: number
            vote_count: number
            season_number: number
          }) => ({
            id: ep.id,
            episode_number: ep.episode_number,
            name: ep.name,
            overview: ep.overview || "",
            air_date: ep.air_date,
            runtime: ep.runtime,
            still_path: ep.still_path,
            vote_average: ep.vote_average || 0,
            vote_count: ep.vote_count || 0,
            season_number: ep.season_number,
          }),
        ) || [],
    }
  } catch (error) {
    console.error("Failed to fetch season details:", error)
    return null
  }
}

/**
 * Fetch full episode details including guest stars, crew, images, and videos
 * @param tvId - TMDB TV show ID
 * @param seasonNumber - Season number
 * @param episodeNumber - Episode number
 * @returns Episode details or null
 */
export async function getEpisodeDetails(
  tvId: number,
  seasonNumber: number,
  episodeNumber: number,
): Promise<TMDBEpisodeDetails | null> {
  if (!TMDB_BEARER_TOKEN) {
    console.error("TMDB API credentials not set")
    return null
  }

  try {
    const response = await tmdbFetch(
      `/tv/${tvId}/season/${seasonNumber}/episode/${episodeNumber}`,
      { next: { revalidate: 3600 } }, // Cache for 1 hour
      { append_to_response: "images,videos" },
    )

    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status}`)
    }

    const data = await response.json()

    return {
      id: data.id,
      episode_number: data.episode_number,
      season_number: data.season_number,
      name: data.name || `Episode ${data.episode_number}`,
      overview: data.overview || "",
      air_date: data.air_date || null,
      runtime: data.runtime || null,
      still_path: data.still_path || null,
      vote_average: data.vote_average || 0,
      vote_count: data.vote_count || 0,
      guest_stars:
        data.guest_stars?.map(
          (gs: {
            id: number
            name: string
            character: string
            profile_path: string | null
            order: number
          }) => ({
            id: gs.id,
            name: gs.name,
            character: gs.character,
            profile_path: gs.profile_path,
            order: gs.order,
          }),
        ) || [],
      crew:
        data.crew?.map(
          (c: {
            id: number
            name: string
            job: string
            department: string
            profile_path: string | null
          }) => ({
            id: c.id,
            name: c.name,
            job: c.job,
            department: c.department,
            profile_path: c.profile_path,
          }),
        ) || [],
      images: data.images
        ? {
            stills:
              data.images.stills?.map(
                (img: {
                  aspect_ratio: number
                  height: number
                  iso_639_1: string | null
                  file_path: string
                  vote_average: number
                  vote_count: number
                  width: number
                }) => ({
                  aspect_ratio: img.aspect_ratio,
                  height: img.height,
                  iso_639_1: img.iso_639_1,
                  file_path: img.file_path,
                  vote_average: img.vote_average,
                  vote_count: img.vote_count,
                  width: img.width,
                }),
              ) || [],
          }
        : undefined,
      videos: data.videos
        ? {
            results: data.videos.results || [],
          }
        : undefined,
    }
  } catch (error) {
    console.error("Failed to fetch episode details:", error)
    return null
  }
}

/**
 * Fetch full collection details
 * @param collectionId - TMDB collection ID
 * @returns Collection details with parts or null
 */
export async function getCollectionDetails(
  collectionId: number,
): Promise<TMDBCollectionDetails | null> {
  if (!TMDB_BEARER_TOKEN) {
    console.error("TMDB API credentials not set")
    return null
  }

  try {
    const response = await tmdbFetch(`/collection/${collectionId}`, {
      next: { revalidate: 604800 },
    }) // Cache for 1 week

    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status}`)
    }

    const data: TMDBCollectionDetails = await response.json()
    // Inject media_type="movie" for parts since collections only contain movies
    if (data.parts) {
      data.parts = data.parts.map((part) => ({ ...part, media_type: "movie" }))
    }
    return data
  } catch (error) {
    console.error("Failed to fetch collection details:", error)
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
  if (!TMDB_BEARER_TOKEN || !query.trim()) {
    return { page: 1, results: [], total_pages: 0, total_results: 0 }
  }

  try {
    const response = await tmdbFetch(
      "/search/multi",
      { next: { revalidate: 300 } },
      {
        query: query,
        page: page.toString(),
        include_adult: "false",
      },
    ) // Cache for 5 minutes

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
  if (!TMDB_BEARER_TOKEN) {
    console.error("TMDB API credentials not set")
    return null
  }

  try {
    const response = await tmdbFetch(
      `/person/${personId}`,
      { next: { revalidate: 604800 } },
      { append_to_response: "combined_credits" },
    ) // Cache for 1 week

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
  if (!TMDB_BEARER_TOKEN) {
    console.error("TMDB API credentials not set")
    return null
  }

  try {
    const response = await tmdbFetch(
      `/${mediaType}/${mediaId}/watch/providers`,
      { next: { revalidate: 2592000 } },
    ) // Cache for 30 days

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
  return fetchMediaList(
    `/${mediaType}/${mediaId}/similar`,
    mediaType,
    "Failed to fetch similar media:",
  )
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
  return fetchMediaList(
    `/${mediaType}/${mediaId}/recommendations`,
    mediaType,
    "Failed to fetch recommendations:",
  )
}

/**
 * Fetch reviews for a movie or TV show
 * @param mediaId - TMDB media ID
 * @param mediaType - "movie" or "tv"
 * @returns Reviews response or null
 */
export async function getReviews(
  mediaId: number,
  mediaType: "movie" | "tv",
): Promise<TMDBReviewsResponse | null> {
  if (!TMDB_BEARER_TOKEN) {
    console.error("TMDB API credentials not set")
    return null
  }

  try {
    const response = await tmdbFetch(`/${mediaType}/${mediaId}/reviews`, {
      next: { revalidate: 172800 },
    }) // Cache for 2 days

    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status}`)
    }

    return response.json()
  } catch (error) {
    console.error("Failed to fetch reviews:", error)
    return null
  }
}

// ========================================
// Discover Page API Functions
// ========================================

/**
 * Fetch movie genres from TMDB
 * Cached indefinitely since genres rarely change
 * @returns Array of movie genres
 */
export async function getMovieGenres(): Promise<Genre[]> {
  if (!TMDB_BEARER_TOKEN) {
    console.error("TMDB API credentials not set")
    return []
  }

  try {
    // cache: 'force-cache' ensures this is cached indefinitely
    // Genres rarely change, so we don't need revalidation
    const response = await tmdbFetch("/genre/movie/list", {
      cache: "force-cache",
    })

    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status}`)
    }

    const data: TMDBGenreListResponse = await response.json()
    return data.genres
  } catch (error) {
    console.error("Failed to fetch movie genres:", error)
    return []
  }
}

/**
 * Fetch TV genres from TMDB
 * Cached indefinitely since genres rarely change
 * @returns Array of TV genres
 */
export async function getTVGenres(): Promise<Genre[]> {
  if (!TMDB_BEARER_TOKEN) {
    console.error("TMDB API credentials not set")
    return []
  }

  try {
    // cache: 'force-cache' ensures this is cached indefinitely
    // Genres rarely change, so we don't need revalidation
    const response = await tmdbFetch("/genre/tv/list", { cache: "force-cache" })

    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status}`)
    }

    const data: TMDBGenreListResponse = await response.json()
    return data.genres
  } catch (error) {
    console.error("Failed to fetch TV genres:", error)
    return []
  }
}

/**
 * Fetch available languages from TMDB
 * Cached indefinitely since language list rarely changes
 * @returns Array of languages
 */
export async function getLanguages(): Promise<TMDBLanguage[]> {
  if (!TMDB_BEARER_TOKEN) {
    console.error("TMDB API credentials not set")
    return []
  }

  try {
    // cache: 'force-cache' ensures this is cached indefinitely
    // Language list rarely changes
    const response = await tmdbFetch("/configuration/languages", {
      cache: "force-cache",
    })

    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status}`)
    }

    const data: TMDBLanguage[] = await response.json()
    // Sort by English name for better UX
    return data.sort((a, b) => a.english_name.localeCompare(b.english_name))
  } catch (error) {
    console.error("Failed to fetch languages:", error)
    return []
  }
}

/**
 * Fetch available watch providers for a region
 * Cached indefinitely since provider list rarely changes
 * @param mediaType - "movie" or "tv"
 * @param region - Region code (default: "US")
 * @returns Array of watch provider options
 */
export async function getWatchProviderList(
  mediaType: "movie" | "tv",
  region: string = "US",
): Promise<TMDBWatchProviderOption[]> {
  if (!TMDB_BEARER_TOKEN) {
    console.error("TMDB API credentials not set")
    return []
  }

  try {
    // cache: 'force-cache' ensures this is cached indefinitely
    // Provider list doesn't change frequently
    const response = await tmdbFetch(
      `/watch/providers/${mediaType}`,
      { cache: "force-cache" },
      { watch_region: region },
    )

    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status}`)
    }

    const data: TMDBWatchProviderListResponse = await response.json()
    // Sort by display priority for the region
    return data.results.sort((a, b) => {
      const priorityA = a.display_priorities?.[region] ?? 999
      const priorityB = b.display_priorities?.[region] ?? 999
      return priorityA - priorityB
    })
  } catch (error) {
    console.error("Failed to fetch watch providers:", error)
    return []
  }
}

/** Default watch region for discover filters */
export const DEFAULT_WATCH_REGION = "US"

/**
 * Discover movies or TV shows with filters
 * @param params - Filter parameters
 * @returns Discover response with results
 */
export async function discoverMedia(
  params: DiscoverParams,
): Promise<TMDBDiscoverResponse> {
  if (!TMDB_BEARER_TOKEN) {
    console.error("TMDB API credentials not set")
    return { page: 1, results: [], total_pages: 0, total_results: 0 }
  }

  const {
    mediaType,
    page = 1,
    year,
    sortBy,
    rating,
    language,
    genre,
    providers,
    region = DEFAULT_WATCH_REGION,
  } = params

  // Build query parameters (excluding api_key, which is now in headers)
  const queryParams: Record<string, string> = {
    page: page.toString(),
    include_adult: "false",
  }

  // Sort by mapping
  if (sortBy) {
    switch (sortBy) {
      case "popularity":
        queryParams["sort_by"] = "popularity.desc"
        break
      case "top_rated":
        queryParams["sort_by"] = "vote_average.desc"
        // Add vote count filter to avoid low-vote items dominating
        queryParams["vote_count.gte"] = "200"
        break
      case "newest":
        queryParams["sort_by"] =
          mediaType === "movie"
            ? "primary_release_date.desc"
            : "first_air_date.desc"
        break
    }
  } else {
    // Default sort
    queryParams["sort_by"] = "popularity.desc"
  }

  // Year filter
  if (year) {
    if (mediaType === "movie") {
      queryParams["primary_release_year"] = year.toString()
    } else {
      queryParams["first_air_date_year"] = year.toString()
    }
  }

  // Rating filter
  if (rating) {
    queryParams["vote_average.gte"] = rating.toString()
  }

  // Language filter
  if (language) {
    queryParams["with_original_language"] = language
  }

  // Genre filter
  if (genre) {
    queryParams["with_genres"] = genre.toString()
  }

  // Providers filter
  if (providers && providers.length > 0) {
    queryParams["with_watch_providers"] = providers.join("|")
    queryParams["watch_region"] = region
  }

  try {
    const response = await tmdbFetch(
      `/discover/${mediaType}`,
      { next: { revalidate: 300 } },
      queryParams,
    ) // Cache for 5 minutes

    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status}`)
    }

    const data: TMDBDiscoverResponse = await response.json()
    // Inject media_type into results
    data.results = data.results.map((item) => ({
      ...item,
      media_type: mediaType,
    }))
    return data
  } catch (error) {
    console.error("Failed to discover media:", error)
    return { page: 1, results: [], total_pages: 0, total_results: 0 }
  }
}
