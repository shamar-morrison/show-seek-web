import type { TMDBEpisode as Episode } from "@/types/tmdb"

export type SeasonEpisodeInput = Pick<
  Episode,
  "id" | "episode_number" | "name"
> & {
  air_date: string | null
  /** Per-episode runtime in minutes when the producer has it in scope */
  runtime?: number | null
}
