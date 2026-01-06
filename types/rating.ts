/**
 * Rating type definitions for user media ratings
 */

export interface Rating {
  /** User's Firebase UID */
  userId: string
  /** TMDB media ID */
  mediaId: number
  /** Type of media */
  mediaType: "movie" | "tv"
  /** Rating value from 1-10 */
  rating: number
  /** Title of the media for display purposes */
  mediaTitle: string
  /** Poster path for display purposes (optional) */
  posterPath: string | null
  /** Timestamp when rating was created */
  createdAt: number
  /** Timestamp when rating was last updated */
  updatedAt: number
}

/**
 * Input type for creating/updating a rating (without timestamps)
 */
export type RatingInput = Omit<Rating, "createdAt" | "updatedAt">
