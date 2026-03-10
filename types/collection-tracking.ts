export interface TrackedCollection {
  collectionId: number
  name: string
  totalMovies: number
  watchedMovieIds: number[]
  startedAt: number
  lastUpdated: number
}

export interface CollectionProgressItem {
  collectionId: number
  name: string
  posterPath: string | null
  backdropPath: string | null
  watchedCount: number
  totalMovies: number
  percentage: number
  lastUpdated: number
}
