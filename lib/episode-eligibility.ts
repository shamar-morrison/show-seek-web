import { isTmdbDateOnOrBeforeToday } from "@/lib/tmdb-date"

/**
 * Shared episode eligibility filter for mark-as-watched actions.
 *
 * Mirrors mobile's `src/utils/episodeEligibility.ts`:
 * - Episodes without an air date are never markable, even when
 *   `allowUnreleased` is true.
 * - Future-dated episodes are markable only when `allowUnreleased` is true.
 * - Otherwise only episodes that have already aired are markable.
 *
 * Season 0 (specials) filtering is intentionally left to the caller, matching
 * mobile.
 */
export function getMarkableEpisodes<T extends { air_date: string | null }>(
  episodes: T[],
  allowUnreleased: boolean,
): T[] {
  return episodes.filter(
    (episode) =>
      !!episode.air_date &&
      (allowUnreleased || isTmdbDateOnOrBeforeToday(episode.air_date)),
  )
}
