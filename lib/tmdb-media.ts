import type { TMDBActionableMedia, TMDBMedia } from "@/types/tmdb"

export function isActionableMedia(
  media: TMDBMedia,
): media is TMDBActionableMedia {
  return media.media_type === "movie" || media.media_type === "tv"
}
