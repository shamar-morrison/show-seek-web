import { isTmdbDateOnOrBeforeToday } from "@/lib/tmdb-date"
import type { TMDBSeason, TMDBSeasonEpisode } from "@/types/tmdb"

/**
 * Parse episode key (e.g., "1_3") to season and episode numbers
 * Format: {seasonNumber}_{episodeNumber}
 */
export function parseEpisodeKey(
  key: string,
): { season: number; episode: number } | null {
  const match = key.match(/^(\d+)_(\d+)$/)
  if (!match) return null
  return {
    season: parseInt(match[1], 10),
    episode: parseInt(match[2], 10),
  }
}

export interface NextEpisodeInfo {
  season: number
  episode: number
  title: string
  airDate: string | null
}

/**
 * Computes the next episode to watch after the current episode is marked as watched.
 * Considers only aired episodes and looks for the next episode in the current season,
 * or the first episode of the next season if at the end of the current season.
 *
 * @param currentEpisode - The episode being marked as watched
 * @param allSeasonEpisodes - All episodes in the current season
 * @param tvShowSeasons - Optional array of all seasons in the TV show
 * @returns NextEpisodeInfo if there is a next episode, null if caught up
 */
export function computeNextEpisode(
  currentEpisode: { season_number: number; episode_number: number },
  allSeasonEpisodes: TMDBSeasonEpisode[],
  tvShowSeasons?: TMDBSeason[],
  watchedKeys?: Set<string> | Record<string, unknown>,
): NextEpisodeInfo | null {
  // Filter to only aired episodes and sort by episode number to ensure correct order
  const airedEpisodes = allSeasonEpisodes
    .filter((ep) => isTmdbDateOnOrBeforeToday(ep.air_date))
    .sort((a, b) => a.episode_number - b.episode_number)

  const isWatched = (s: number, e: number) => {
    if (
      s === currentEpisode.season_number &&
      e === currentEpisode.episode_number
    ) {
      return true
    }
    if (!watchedKeys) return false
    const key = `${s}_${e}`
    return watchedKeys instanceof Set
      ? watchedKeys.has(key)
      : Boolean((watchedKeys as Record<string, unknown>)[key])
  }

  if (watchedKeys) {
    const firstUnwatched = airedEpisodes.find(
      (ep) => !isWatched(ep.season_number, ep.episode_number),
    )

    if (firstUnwatched) {
      return {
        season: firstUnwatched.season_number,
        episode: firstUnwatched.episode_number,
        title: firstUnwatched.name,
        airDate: firstUnwatched.air_date,
      }
    }
  } else {
    // Find the current episode index in aired episodes
    const currentIndex = airedEpisodes.findIndex(
      (ep) => ep.episode_number === currentEpisode.episode_number,
    )

    // Check if there's a next episode in this season
    if (currentIndex >= 0 && currentIndex < airedEpisodes.length - 1) {
      const nextEp = airedEpisodes[currentIndex + 1]
      return {
        season: nextEp.season_number,
        episode: nextEp.episode_number,
        title: nextEp.name,
        airDate: nextEp.air_date,
      }
    }
  }

  // If current season is complete, check subsequent seasons
  if (tvShowSeasons && tvShowSeasons.length > 0) {
    // Filter to regular seasons after current and sort by season number
    const nextSeasons = tvShowSeasons
      .filter(
        (s) =>
          s.season_number > currentEpisode.season_number && s.season_number > 0,
      )
      .sort((a, b) => a.season_number - b.season_number)

    for (const nextSeason of nextSeasons) {
      const candidateEpisodes = (
        nextSeason as { episodes?: TMDBSeasonEpisode[] }
      ).episodes

      if (candidateEpisodes && candidateEpisodes.length > 0) {
        const nextAiredEpisodes = candidateEpisodes
          .filter((ep) => isTmdbDateOnOrBeforeToday(ep.air_date))
          .sort((a, b) => a.episode_number - b.episode_number)

        const firstUnwatchedInSeason = watchedKeys
          ? nextAiredEpisodes.find(
              (ep) =>
                !isWatched(
                  ep.season_number ?? nextSeason.season_number,
                  ep.episode_number,
                ),
            )
          : nextAiredEpisodes[0]

        if (firstUnwatchedInSeason) {
          return {
            season:
              firstUnwatchedInSeason.season_number ?? nextSeason.season_number,
            episode: firstUnwatchedInSeason.episode_number,
            title: firstUnwatchedInSeason.name,
            airDate: firstUnwatchedInSeason.air_date,
          }
        }
        // All aired episodes in this season are watched, continue to next season
        continue
      }

      if (watchedKeys) {
        const episodeCount = nextSeason.episode_count ?? 1
        let foundUnwatchedEpisode: number | null = null

        for (let epNum = 1; epNum <= episodeCount; epNum += 1) {
          if (!isWatched(nextSeason.season_number, epNum)) {
            foundUnwatchedEpisode = epNum
            break
          }
        }

        if (foundUnwatchedEpisode !== null) {
          return {
            season: nextSeason.season_number,
            episode: foundUnwatchedEpisode,
            title: `${nextSeason.name || `Season ${nextSeason.season_number}`} Episode ${foundUnwatchedEpisode}`,
            airDate: nextSeason.air_date || null,
          }
        }
        // All episodes in this season are watched, continue to next season
        continue
      }

      // Fallback when watchedKeys is not provided
      return {
        season: nextSeason.season_number,
        episode: 1,
        title: `${nextSeason.name} Episode 1`,
        airDate: nextSeason.air_date || null,
      }
    }
  }

  // No more episodes - user is caught up!
  return null
}
