/**
 * Rating type definitions for user media ratings
 * Matches mobile app Firebase structure
 */

export interface Rating {
  /** Document ID (same as mediaType-mediaId or episode format) */
  id: string
  /** TMDB media ID as string */
  mediaId: string
  /** Type of media */
  mediaType: "movie" | "tv" | "episode"
  /** Rating value from 1-10 */
  rating: number
  /** Title of the media for display purposes */
  title: string
  /** Poster path for display purposes */
  posterPath: string | null
  /** Release date string (YYYY-MM-DD) */
  releaseDate: string | null
  /** Timestamp when rating was created (milliseconds) */
  ratedAt: number
  // Episode-specific fields (only present for episodes)
  /** TMDB TV Show ID (for episodes) */
  tvShowId?: number
  /** Season number (for episodes) */
  seasonNumber?: number
  /** Episode number (for episodes) */
  episodeNumber?: number
  /** Episode name (for episodes) */
  episodeName?: string
  /** TV Show name (for episodes) */
  tvShowName?: string
}

/**
 * Input type for creating/updating a rating (without timestamps)
 */
export type RatingInput = Omit<Rating, "ratedAt"> & {
  /** User's Firebase UID (used for validation) */
  userId: string
}
