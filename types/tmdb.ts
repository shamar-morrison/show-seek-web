/**
 * TMDB API TypeScript Interfaces
 * Provides strongly-typed definitions for TMDB API responses
 */

/** TMDB API Configuration response for image URLs */
export interface TMDBConfiguration {
  images: {
    base_url: string
    secure_base_url: string
    backdrop_sizes: string[]
    logo_sizes: string[]
    poster_sizes: string[]
    profile_sizes: string[]
    still_sizes: string[]
  }
  change_keys: string[]
}

/** Media type enum for trending content */
export type MediaType = "movie" | "tv" | "person"

/** Individual media item from trending endpoint */
export interface TMDBMedia {
  id: number
  media_type: MediaType
  adult: boolean
  backdrop_path: string | null
  poster_path: string | null
  title?: string // For movies
  name?: string // For TV shows
  original_title?: string
  original_name?: string
  overview: string
  genre_ids: number[]
  popularity: number
  release_date?: string // For movies
  first_air_date?: string // For TV shows
  vote_average: number
  vote_count: number
  original_language: string
}

/** Response from trending endpoint */
export interface TMDBTrendingResponse {
  page: number
  results: TMDBMedia[]
  total_pages: number
  total_results: number
}

/** Individual logo/image from images endpoint */
export interface TMDBLogo {
  aspect_ratio: number
  height: number
  iso_639_1: string | null
  file_path: string
  vote_average: number
  vote_count: number
  width: number
}

/** Response from images endpoint */
export interface TMDBImagesResponse {
  id: number
  backdrops: TMDBLogo[]
  logos: TMDBLogo[]
  posters: TMDBLogo[]
}

/** Individual video from videos endpoint */
export interface TMDBVideo {
  id: string
  iso_639_1: string
  iso_3166_1: string
  key: string
  name: string
  site: string
  size: number
  type: string
  official: boolean
  published_at: string
}

/** Response from videos endpoint */
export interface TMDBVideosResponse {
  id: number
  results: TMDBVideo[]
}

/** Processed hero media data ready for UI consumption */
export interface HeroMedia {
  id: number
  title: string
  overview: string
  backdropUrl: string
  logoUrl: string | null
  mediaType: MediaType
  releaseYear: string | null
  voteAverage: number
  trailerKey: string | null
}

/** Error response structure */
export interface TMDBError {
  status_code: number
  status_message: string
  success: boolean
}
