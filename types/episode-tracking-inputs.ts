import type { TMDBEpisode as Episode } from "@/types/tmdb"

export type SeasonEpisodeInput = Pick<Episode, "id" | "episode_number" | "name"> & {
  air_date: string | null
}
