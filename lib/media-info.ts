import { TMDBSearchResult } from "@/types/tmdb"
import { Film01Icon, Tv01Icon, UserIcon } from "@hugeicons/core-free-icons"

export interface SearchResultInfo {
  isMovie: boolean
  isTV: boolean
  isPerson: boolean
  title: string
  imageUrl: string | null
  year: string | null
  rating: number | null
  mediaTypeLabel: string
  MediaTypeIcon: typeof Film01Icon
  href: string
}

/**
 * Hook to extract display information from a TMDB search result
 */
export function useSearchResultInfo(
  result: TMDBSearchResult,
): SearchResultInfo {
  const isMovie = result.media_type === "movie"
  const isTV = result.media_type === "tv"
  const isPerson = result.media_type === "person"

  const title = result.title || result.name || "Unknown"
  const imagePath = isPerson ? result.profile_path : result.poster_path
  // Use slightly larger image for cards, logic can be refined if needed per component
  // passing size as argument if needed, but for now w342 covers most cases safely
  // SearchResultItem used w92, SearchResultCard used w342.
  // I might need to make size configurable or return valid path to be built by caller?
  // Or just return the path and let caller build url?
  // The caller needs width.
  // Let's stick to returning raw data and a helper, or just let caller build image.
  // But duplicate logic included `imagePath = ...`.
  // Let's return `imagePath` and let caller decide size, or accept size as arg.

  // Let's accept size as optional arg, default to "w342"
  // Actually SearchResultItem uses w92, card uses w342.

  const dateStr = isMovie ? result.release_date : result.first_air_date
  const year = dateStr ? dateStr.split("-")[0] : null

  const rating =
    result.vote_average && !isPerson
      ? Math.round(result.vote_average * 10) / 10
      : null

  const href = isMovie
    ? `/movie/${result.id}`
    : isTV
      ? `/tv/${result.id}`
      : `/person/${result.id}`

  const getMediaTypeInfo = () => {
    if (isMovie) return { label: "Movie", icon: Film01Icon }
    if (isTV) return { label: "TV Show", icon: Tv01Icon }
    return { label: result.known_for_department || "Person", icon: UserIcon }
  }

  const { label: mediaTypeLabel, icon: MediaTypeIcon } = getMediaTypeInfo()

  // We return a builder function or just the path to be flexible?
  // Let's return the computed `imagePath` so component can call `buildImageUrl(imagePath, size)`

  return {
    isMovie,
    isTV,
    isPerson,
    title,
    imageUrl: null, // deprecated/unused in favor of raw data? No, let's keep it simple.
    // Let's return imagePath to be flexible
    // But wait, the hook is "useSearchResultInfo".
    year,
    rating,
    mediaTypeLabel,
    MediaTypeIcon,
    href,
  }
}

// Revised approach: helper function instead of hook since it doesn't use state/effects
export function getSearchResultInfo(result: TMDBSearchResult) {
  const isMovie = result.media_type === "movie"
  const isTV = result.media_type === "tv"
  const isPerson = result.media_type === "person"

  const title = result.title || result.name || "Unknown"
  const imagePath = isPerson ? result.profile_path : result.poster_path

  const dateStr = isMovie ? result.release_date : result.first_air_date
  const year = dateStr ? dateStr.split("-")[0] : null

  const rating =
    result.vote_average && !isPerson
      ? Math.round(result.vote_average * 10) / 10
      : null

  const href = isMovie
    ? `/movie/${result.id}`
    : isTV
      ? `/tv/${result.id}`
      : `/person/${result.id}`

  const getMediaTypeInfo = () => {
    if (isMovie) return { label: "Movie", icon: Film01Icon }
    if (isTV) return { label: "TV Show", icon: Tv01Icon }
    // Let's standardize on "TV Show" but keep it flexible?
    // search-results-client: "TV Show"
    // search-result-item: "TV"
    // I will use "TV Show" as standard. component can override if really needed, but consistency is better.
    return { label: result.known_for_department || "Person", icon: UserIcon }
  }

  const { label: mediaTypeLabel, icon: MediaTypeIcon } = getMediaTypeInfo()

  return {
    isMovie,
    isTV,
    isPerson,
    title,
    imagePath,
    year,
    rating,
    mediaTypeLabel,
    MediaTypeIcon,
    href,
  }
}
