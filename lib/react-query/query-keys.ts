export const UNAUTHENTICATED_USER_ID = "__unauthenticated__" as const

export const queryKeys = {
  mediaDetails: (mediaType: "movie" | "tv", id: number) =>
    ["media-details", mediaType, id] as const,

  tmdb: {
    tvShowDetails: (tvShowId: number) => ["tv", tvShowId, "details"] as const,
    seasonEpisodes: (tvShowId: number, seasonNumber: number) =>
      ["tv", tvShowId, "season", seasonNumber] as const,
    mediaImages: (mediaId: number, mediaType: "movie" | "tv") =>
      [mediaType, mediaId, "images"] as const,
    mediaVideos: (mediaId: number, mediaType: "movie" | "tv") =>
      [mediaType, mediaId, "videos"] as const,
    mediaReviews: (mediaId: number, mediaType: "movie" | "tv") =>
      [mediaType, mediaId, "reviews"] as const,
    recommendations: (mediaId: number, mediaType: "movie" | "tv") =>
      [mediaType, mediaId, "recommendations"] as const,
  },

  trakt: {
    reviews: (mediaId: number, mediaType: "movie" | "tv") =>
      ["trakt", mediaType, mediaId, "reviews"] as const,
  },

  forYou: {
    seedTitle: (mediaType: "movie" | "tv", id: number) =>
      ["for-you", "seed-title", mediaType, id] as const,
    recommendations: (mediaType: "movie" | "tv", id: number) =>
      ["for-you", "recommendations", mediaType, id] as const,
    hiddenGems: () => ["for-you", "hidden-gems"] as const,
    trendingWeek: () => ["for-you", "trending-week"] as const,
  },

  firestore: {
    lists: (userId: string) => ["firestore", "lists", userId] as const,
    ratings: (userId: string) => ["firestore", "ratings", userId] as const,
    notes: (userId: string) => ["firestore", "notes", userId] as const,
    favoritePersons: (userId: string) =>
      ["firestore", "favorite-persons", userId] as const,
    watchedMovies: (userId: string, movieId: number) =>
      ["firestore", "watched-movies", userId, movieId] as const,
    episodeTrackingAll: (userId: string) =>
      ["firestore", "episode-tracking", userId, "all"] as const,
    episodeTrackingShow: (userId: string, tvShowId: number) =>
      ["firestore", "episode-tracking", userId, "show", tvShowId] as const,
  },
}

export const tmdbQueryKeys = queryKeys.tmdb
export const traktQueryKeys = queryKeys.trakt
