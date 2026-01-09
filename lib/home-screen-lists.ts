import { HomeScreenListItem } from "./firebase/user"

/**
 * Available TMDB lists for home screen customization
 */
export const AVAILABLE_TMDB_LISTS = [
  { id: "latest-trailers", label: "Latest Trailers" }, // Premium only
  { id: "trending-movies", label: "Trending Movies" },
  { id: "trending-tv", label: "Trending TV Shows" },
  { id: "popular-movies", label: "Popular Movies" },
  { id: "top-rated-movies", label: "Top Rated" },
  { id: "upcoming-movies", label: "Upcoming Movies" },
  { id: "upcoming-tv", label: "Upcoming TV Shows" },
] as const

/** Maximum number of lists allowed on home screen */
export const MAX_HOME_LISTS = 6

/** Minimum number of lists required on home screen */
export const MIN_HOME_LISTS = 1

/** Default home screen configuration if none saved */
export const DEFAULT_HOME_LISTS: HomeScreenListItem[] = [
  { id: "trending-movies", type: "tmdb", label: "Trending Movies" },
  { id: "trending-tv", type: "tmdb", label: "Trending TV Shows" },
  { id: "popular-movies", type: "tmdb", label: "Popular Movies" },
  { id: "upcoming-movies", type: "tmdb", label: "Upcoming Movies" },
  { id: "upcoming-tv", type: "tmdb", label: "Upcoming TV Shows" },
  { id: "top-rated-movies", type: "tmdb", label: "Top Rated" },
]

/** ID of the premium-only list */
export const PREMIUM_LIST_ID = "latest-trailers"
