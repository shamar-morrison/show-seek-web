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

export type TraktSyncState =
  | "idle"
  | "queued"
  | "in_progress"
  | "retrying"
  | "completed"
  | "failed"

export type TraktErrorCategory =
  | "auth_invalid"
  | "internal"
  | "locked_account"
  | "storage_limit"
  | "rate_limited"
  | "upstream_blocked"
  | "upstream_unavailable"

export type SyncErrorCategory = TraktErrorCategory

export interface TraktDiagnostics {
  cfRay?: string
  endpoint?: string
  retryAfterSeconds?: number
  retryReason?: string
  snippet?: string
  statusCode?: number
}

export interface SyncStatus {
  connected: boolean
  synced: boolean
  status?: TraktSyncState
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
  errorCategory?: TraktErrorCategory
  errorMessage?: string
  errors?: string[]
  diagnostics?: TraktDiagnostics
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
  // Zip import state & actions (from useTraktZipImport)
  isZipImporting: boolean
  isZipImportRateLimited: boolean
  nextAllowedZipImportAt: Date | null
  zipImportUiState: TraktZipImportUIState
  zipUploadProgress: number
  zipImportDoc: TraktZipImportProgressDoc | null
  zipImportError: string | null
  selectedZipFile: SelectedZipFile | null
  startZipImport: (file: File) => Promise<void>
  dismissZipImport: () => void
  setSelectedZipFile: (file: SelectedZipFile | null) => void
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
  status: TraktSyncState
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
  errorCategory?: TraktErrorCategory
  errorMessage?: string
  lists: Record<string, ListEnrichmentStatus>
  errors?: string[]
  diagnostics?: TraktDiagnostics
}

// --- Zip Import Types (ported from mobile) ---

export type TraktZipImportUIState =
  | "idle"
  | "uploading"
  | "processing"
  | "completed"
  | "failed"

export type TraktZipImportPhase =
  | "pending"
  | "downloading"
  | "parsing"
  | "syncing"
  | "completed"
  | "failed"

export type TraktZipImportStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"

export interface TraktZipImportStats {
  customLists: number
  episodes: number
  favorites: number
  movies: number
  movieWatches: number
  ratings: number
  shows: number
  watchlist: number
}

export interface TraktZipImportProgressDoc {
  completedAt?: { seconds: number; nanoseconds: number } | number | Date
  createdAt?: { seconds: number; nanoseconds: number } | number | Date
  error?: string
  failedAt?: { seconds: number; nanoseconds: number } | number | Date
  id: string
  nextAllowedImportAt?:
    | { seconds: number; nanoseconds: number }
    | number
    | Date
  progress: {
    current: number
    phase: TraktZipImportPhase
    total: number
  }
  stats: TraktZipImportStats
  status: TraktZipImportStatus
  updatedAt?: { seconds: number; nanoseconds: number } | number | Date
  userId: string
}

export interface SelectedZipFile {
  file: File
  name: string
  size: number
}

