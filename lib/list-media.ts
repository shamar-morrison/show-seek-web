import type { ListMediaItem } from "@/types/list"
import type { TMDBActionableMedia } from "@/types/tmdb"

/** Convert a saved list item back into card-compatible media data. */
export function listItemToMedia(item: ListMediaItem): TMDBActionableMedia {
  const isMovie = item.media_type === "movie"

  return {
    id: item.id,
    media_type: item.media_type,
    adult: false,
    backdrop_path: null,
    poster_path: item.poster_path,
    title: isMovie ? item.title : undefined,
    name: isMovie ? undefined : item.name || item.title,
    overview: "",
    genre_ids: item.genre_ids || [],
    popularity: 0,
    release_date: item.release_date,
    first_air_date: item.first_air_date,
    vote_average: item.vote_average ?? 0,
    vote_count: 0,
    original_language: "",
    ...(isMovie
      ? { original_title: item.original_title }
      : { original_name: item.original_name }),
  }
}
