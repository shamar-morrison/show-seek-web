/**
 * Trakt API TypeScript Interfaces
 * Provides strongly-typed definitions for Trakt API responses
 */

/** Trakt user basic info */
export interface TraktUser {
  username: string
  private: boolean
  name: string | null
  vip: boolean
  vip_ep: boolean
  ids: {
    slug: string
  }
  /** Avatar URL from Trakt */
  avatar?: {
    full: string
  } | null
}

/** Trakt comment/review object */
export interface TraktComment {
  id: number
  parent_id: number | null
  comment: string
  spoiler: boolean
  /** True if comment is 200+ words (considered a review) */
  review: boolean
  replies: number
  likes: number
  created_at: string
  updated_at: string
  user: TraktUser
  /** User's rating (1-10) if they rated the media */
  user_rating: number | null
  user_stats?: {
    rating: number | null
    play_count: number
    completed_count: number
  }
}

/** Response from comments endpoint (array of comments) */
export type TraktCommentsResponse = TraktComment[]
