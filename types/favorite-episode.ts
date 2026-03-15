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

export function getFavoriteEpisodeId(
  tvShowId: number,
  seasonNumber: number,
  episodeNumber: number,
) {
  return `${tvShowId}-${seasonNumber}-${episodeNumber}`
}
