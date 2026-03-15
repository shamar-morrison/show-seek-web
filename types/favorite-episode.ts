export interface FavoriteEpisode {
  id: string
  tvShowId: number
  seasonNumber: number
  episodeNumber: number
  episodeName: string
  showName: string
  posterPath: string | null
  addedAt: number
}

interface FavoriteEpisodePayloadInput {
  tvShowId: number
  episode: {
    season_number: number
    episode_number: number
    name: string
  }
  showName: string
  posterPath: string | null
}

export function getFavoriteEpisodeId(
  tvShowId: number,
  seasonNumber: number,
  episodeNumber: number,
) {
  return `${tvShowId}-${seasonNumber}-${episodeNumber}`
}

export function buildFavoriteEpisodePayload({
  tvShowId,
  episode,
  showName,
  posterPath,
}: FavoriteEpisodePayloadInput): Omit<FavoriteEpisode, "addedAt"> {
  return {
    id: getFavoriteEpisodeId(
      tvShowId,
      episode.season_number,
      episode.episode_number,
    ),
    tvShowId,
    seasonNumber: episode.season_number,
    episodeNumber: episode.episode_number,
    episodeName: episode.name,
    showName,
    posterPath,
  }
}
