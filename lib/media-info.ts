import { getMediaUrl } from "@/lib/utils"
import { TMDBSearchResult } from "@/types/tmdb"
import { Film01Icon, Tv01Icon, UserIcon } from "@hugeicons/core-free-icons"

export interface SearchResultInfo {
  isMovie: boolean
  isTV: boolean
  isPerson: boolean
  title: string
  imagePath: string | null
  year: string | null
  rating: number | null
  mediaTypeLabel: string
  MediaTypeIcon: typeof Film01Icon
  href: string
}

export function getSearchResultInfo(
  result: TMDBSearchResult,
): SearchResultInfo {
  const isMovie = result.media_type === "movie"
  const isTV = result.media_type === "tv"
  const isPerson = result.media_type === "person"

  const title = result.title || result.name || "Unknown"
  const imagePath =
    (isPerson ? result.profile_path : result.poster_path) ?? null

  const dateStr = isMovie ? result.release_date : result.first_air_date
  const year = dateStr ? dateStr.split("-")[0] : null

  const rating =
    result.vote_average && !isPerson
      ? Math.round(result.vote_average * 10) / 10
      : null

  const href = getMediaUrl(result.media_type, result.id)

  const getMediaTypeInfo = () => {
    if (isMovie) return { label: "Movie", icon: Film01Icon }
    if (isTV) return { label: "TV Show", icon: Tv01Icon }
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
