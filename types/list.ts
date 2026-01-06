/**
 * TypeScript definitions for user lists (watchlists, favorites, etc.)
 */

/** Media item stored in a list */
export interface ListMediaItem {
  id: number
  title: string
  poster_path: string | null
  media_type: "movie" | "tv"
  vote_average: number
  release_date: string
  addedAt: number
  genre_ids?: number[]
  // TV show fields
  name?: string
  first_air_date?: string
}

/** User list containing media items */
export interface UserList {
  id: string
  name: string
  items: Record<string, ListMediaItem>
  createdAt: number
  updatedAt?: number
  isCustom?: boolean
}

/** Default list configuration */
export interface DefaultListConfig {
  id: string
  name: string
}

/** Default lists that are always available to users */
export const DEFAULT_LISTS: DefaultListConfig[] = [
  { id: "watchlist", name: "Should Watch" },
  { id: "currently-watching", name: "Watching" },
  { id: "already-watched", name: "Already Watched" },
  { id: "favorites", name: "Favorites" },
  { id: "dropped", name: "Dropped" },
]

/** Set of default list IDs for quick lookup */
export const DEFAULT_LIST_IDS = new Set(DEFAULT_LISTS.map((l) => l.id))
