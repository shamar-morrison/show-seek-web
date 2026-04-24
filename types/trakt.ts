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

export interface TraktSyncItems {
  movies: number
  shows: number
  episodes: number
  ratings: number
  lists: number
  favorites: number
  watchlistItems: number
}

export type SyncSummaryMode = "bootstrap" | "incremental"

export type SyncErrorCategory =
  | "auth_invalid"
  | "internal"
  | "locked_account"
  | "storage_limit"
  | "rate_limited"
  | "upstream_blocked"
  | "upstream_unavailable"

export interface SyncStatus {
  connected: boolean
  synced: boolean
  status?:
    | "idle"
    | "queued"
    | "in_progress"
    | "retrying"
    | "completed"
    | "failed"
  summaryMode?: SyncSummaryMode
  runId?: string
  attempt?: number
  maxAttempts?: number
  nextAllowedSyncAt?: string
  nextRetryAt?: string
  lastSyncedAt?: string
  startedAt?: string
  completedAt?: string
  itemsSynced?: TraktSyncItems
  errorCategory?: SyncErrorCategory
  errorMessage?: string
  errors?: string[]
  diagnostics?: {
    cfRay?: string
    endpoint?: string
    retryAfterSeconds?: number
    retryReason?: string
    snippet?: string
    statusCode?: number
  }
}

export interface TraktState {
  isConnected: boolean
  isSyncing: boolean
  isEnriching: boolean
  lastSyncedAt: Date | null
  lastEnrichedAt: Date | null
  syncStatus: SyncStatus | null
}

export interface TraktContextValue extends TraktState {
  isLoading: boolean
  connectTrakt: () => Promise<void>
  disconnectTrakt: () => Promise<void>
  syncNow: () => Promise<void>
  checkSyncStatus: () => Promise<SyncStatus | undefined>
  enrichData: () => Promise<void>
}

export interface EnrichmentOptions {
  lists?: string[]
  includeEpisodes?: boolean
}

export interface ListEnrichmentStatus {
  exists: boolean
  hasPosters?: boolean
  itemCount?: number
  lastEnriched?: string
  needsEnrichment?: boolean
}

export interface EnrichmentStatus {
  status:
    | "idle"
    | "queued"
    | "in_progress"
    | "retrying"
    | "completed"
    | "failed"
  runId?: string
  attempt?: number
  maxAttempts?: number
  nextAllowedEnrichAt?: string
  nextRetryAt?: string
  startedAt?: string
  completedAt?: string
  includeEpisodes?: boolean
  counts?: {
    episodes: number
    items: number
    lists: number
  }
  errorCategory?: SyncErrorCategory
  errorMessage?: string
  lists: Record<string, ListEnrichmentStatus>
  errors?: string[]
  diagnostics?: {
    cfRay?: string
    endpoint?: string
    retryAfterSeconds?: number
    retryReason?: string
    snippet?: string
    statusCode?: number
  }
}
