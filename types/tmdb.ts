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
  /** Whether the logo is predominantly dark and needs enhanced visibility (e.g., white glow) */
  isDarkLogo: boolean
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

/** Genre object */
export interface Genre {
  id: number
  name: string
}

/** Crew member from credits */
export interface CrewMember {
  id: number
  name: string
  job: string
  department: string
  profile_path: string | null
}

/** Cast member from credits */
export interface CastMember {
  id: number
  name: string
  character: string
  profile_path: string | null
  order: number
}

/** Credits response */
export interface TMDBCredits {
  id: number
  cast: CastMember[]
  crew: CrewMember[]
}

/** Production company */
export interface ProductionCompany {
  id: number
  name: string
  logo_path: string | null
  origin_country: string
}

/** Production country */
export interface ProductionCountry {
  iso_3166_1: string
  name: string
}

/** Spoken language */
export interface SpokenLanguage {
  iso_639_1: string
  name: string
  english_name?: string
}

/** Movie release date with certification */
export interface TMDBMovieReleaseDate {
  certification: string
  iso_639_1: string
  release_date: string
  type: number
}

/** Movie release dates for a country */
export interface TMDBMovieReleaseDateCountry {
  iso_3166_1: string
  release_dates: TMDBMovieReleaseDate[]
}

/** Movie release dates response */
export interface TMDBMovieReleaseDatesResponse {
  id: number
  results: TMDBMovieReleaseDateCountry[]
}

/** TV content rating for a country */
export interface TMDBTVContentRating {
  descriptors: string[]
  iso_3166_1: string
  rating: string
}

/** TV content ratings response */
export interface TMDBTVContentRatingsResponse {
  id: number
  results: TMDBTVContentRating[]
}

/** Full movie details response */
export interface TMDBMovieDetails {
  id: number
  title: string
  original_title: string
  original_language: string
  overview: string
  poster_path: string | null
  backdrop_path: string | null
  release_date: string
  runtime: number | null
  vote_average: number
  vote_count: number
  genres: Genre[]
  status: string
  tagline: string | null
  adult: boolean
  budget: number
  homepage: string | null
  imdb_id: string | null
  revenue: number
  video: boolean
  production_companies: ProductionCompany[]
  production_countries: ProductionCountry[]
  spoken_languages: SpokenLanguage[]
  credits?: TMDBCredits
  release_dates?: TMDBMovieReleaseDatesResponse
  belongs_to_collection: TMDBCollectionInfo | null
}

/** Created by person for TV shows */
export interface CreatedBy {
  id: number
  name: string
  profile_path: string | null
}

export interface TMDBNetwork {
  id: number
  logo_path: string | null
  name: string
  origin_country: string
}

export interface TMDBEpisode {
  id: number
  name: string
  overview: string
  vote_average: number
  vote_count: number
  air_date: string
  episode_number: number
  episode_type: string
  production_code: string
  runtime: number | null
  season_number: number
  show_id: number
  still_path: string | null
}

/** Full TV show details response */
export interface TMDBTVDetails {
  id: number
  name: string
  original_name: string
  original_language: string
  overview: string
  poster_path: string | null
  backdrop_path: string | null
  first_air_date: string
  last_air_date: string | null
  episode_run_time: number[]
  vote_average: number
  vote_count: number
  genres: Genre[]
  status: string
  tagline: string | null
  number_of_seasons: number
  number_of_episodes: number
  in_production: boolean
  languages: string[]
  origin_country: string[]
  networks: TMDBNetwork[]
  last_episode_to_air: TMDBEpisode | null
  next_episode_to_air: TMDBEpisode | null
  seasons: TMDBSeason[]
  created_by: CreatedBy[]
  production_companies: ProductionCompany[]
  production_countries: ProductionCountry[]
  spoken_languages: SpokenLanguage[]
  credits?: TMDBCredits
  content_ratings?: TMDBTVContentRatingsResponse
}

export interface TMDBSeason {
  air_date: string
  episode_count: number
  id: number
  name: string
  overview: string
  poster_path: string | null
  season_number: number
  vote_average: number
}

/** Season episode data with full details */
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

/** Full season details with episodes */
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

/** Guest star from episode credits */
export interface TMDBGuestStar {
  id: number
  name: string
  character: string
  profile_path: string | null
  order: number
}

/** Episode crew member */
export interface TMDBEpisodeCrewMember {
  id: number
  name: string
  job: string
  department: string
  profile_path: string | null
}

/** Full episode details with cast, crew, images, and videos */
export interface TMDBEpisodeDetails {
  id: number
  episode_number: number
  season_number: number
  name: string
  overview: string
  air_date: string | null
  runtime: number | null
  still_path: string | null
  vote_average: number
  vote_count: number
  guest_stars: TMDBGuestStar[]
  crew: TMDBEpisodeCrewMember[]
  images?: {
    stills: TMDBLogo[]
  }
  videos?: {
    results: TMDBVideo[]
  }
}

/** Collection info embedded in movie details */
export interface TMDBCollectionInfo {
  id: number
  name: string
  poster_path: string | null
  backdrop_path: string | null
}

/** Full Collection details from collection endpoint */
export interface TMDBCollectionDetails {
  id: number
  name: string
  overview: string
  poster_path: string | null
  backdrop_path: string | null
  parts: TMDBMedia[]
}

/** Search result from multi-search endpoint */
export interface TMDBSearchResult {
  id: number
  media_type: MediaType
  // Movie fields
  title?: string
  release_date?: string
  // TV fields
  name?: string
  first_air_date?: string
  // Person fields
  known_for_department?: string
  profile_path?: string | null
  // Common fields
  poster_path?: string | null
  backdrop_path?: string | null
  vote_average?: number
  popularity?: number
  overview?: string
  adult?: boolean
}

/** Response from multi-search endpoint */
export interface TMDBSearchResponse {
  page: number
  results: TMDBSearchResult[]
  total_pages: number
  total_results: number
}

/** Person cast member from combined credits */
export interface PersonCastMember {
  id: number
  media_type: "movie" | "tv"
  title?: string // For movies
  name?: string // For TV shows
  poster_path: string | null
  backdrop_path: string | null
  release_date?: string // For movies
  first_air_date?: string // For TV shows
  character: string
  vote_average: number
  vote_count: number
  overview: string
  adult: boolean
  genre_ids: number[]
  popularity: number
}

/** Person crew member from combined credits */
export interface PersonCrewMember {
  id: number
  media_type: "movie" | "tv"
  title?: string // For movies
  name?: string // For TV shows
  poster_path: string | null
  backdrop_path: string | null
  release_date?: string // For movies
  first_air_date?: string // For TV shows
  department: string
  job: string
  vote_average: number
  vote_count: number
  overview: string
  adult: boolean
  genre_ids: number[]
  popularity: number
}

/** Person combined credits response */
export interface TMDBPersonCombinedCredits {
  cast: PersonCastMember[]
  crew: PersonCrewMember[]
}

/** Full person details response */
export interface TMDBPersonDetails {
  id: number
  name: string
  also_known_as: string[]
  biography: string
  birthday: string | null
  deathday: string | null
  gender: number
  homepage: string | null
  imdb_id: string | null
  known_for_department: string
  place_of_birth: string | null
  popularity: number
  profile_path: string | null
  adult: boolean
  combined_credits?: TMDBPersonCombinedCredits
}

/** Individual watch provider */
export interface WatchProvider {
  logo_path: string
  provider_id: number
  provider_name: string
  display_priority: number
}

/** Watch providers grouped by type for a specific region */
export interface WatchProviders {
  link: string // JustWatch attribution URL
  flatrate?: WatchProvider[] // Streaming
  rent?: WatchProvider[]
  buy?: WatchProvider[]
}

/** Response from watch providers endpoint */
export interface WatchProvidersResponse {
  id: number
  results: Record<string, WatchProviders> // Keyed by country code (e.g., "US")
}

/** Author details for a review */
export interface TMDBReviewAuthor {
  name: string
  username: string
  avatar_path: string | null
  rating: number | null
}

/** Individual review from reviews endpoint */
export interface TMDBReview {
  id: string
  author: string
  author_details: TMDBReviewAuthor
  content: string
  created_at: string
  updated_at: string
  url: string
}

/** Response from reviews endpoint */
export interface TMDBReviewsResponse {
  id: number
  page: number
  results: TMDBReview[]
  total_pages: number
  total_results: number
}

/** Response from genre list endpoints */
export interface TMDBGenreListResponse {
  genres: Genre[]
}

/** Language from configuration/languages endpoint */
export interface TMDBLanguage {
  iso_639_1: string
  english_name: string
  name: string
}

/** Watch provider option from watch/providers endpoint */
export interface TMDBWatchProviderOption {
  provider_id: number
  provider_name: string
  logo_path: string
  display_priorities: Record<string, number>
}

/** Response from watch/providers list endpoint */
export interface TMDBWatchProviderListResponse {
  results: TMDBWatchProviderOption[]
}

/** Parameters for discover endpoint */
export interface DiscoverParams {
  mediaType: "movie" | "tv"
  page?: number
  year?: number
  sortBy?: "popularity" | "top_rated" | "newest"
  rating?: number // vote_average.gte
  language?: string // with_original_language
  genre?: number // with_genres
  providers?: number[] // with_watch_providers
  region?: string // watch_region
}

/** Response from discover endpoint */
export interface TMDBDiscoverResponse {
  page: number
  results: TMDBMedia[]
  total_pages: number
  total_results: number
}
