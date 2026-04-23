"use server"

import type { FetchReleaseCalendarInput } from "@/types/release-calendar"

export async function searchMedia(query: string) {
  return (await import("./server-actions/search")).searchMedia(query)
}

export async function fetchReleaseCalendarReleases(
  input: FetchReleaseCalendarInput,
) {
  return (
    await import("./server-actions/release-calendar")
  ).fetchReleaseCalendarReleases(input)
}

export async function fetchTVShowDetails(tvShowId: number) {
  return (await import("./server-actions/tmdb")).fetchTVShowDetails(tvShowId)
}

export async function fetchSeasonEpisodes(
  tvShowId: number,
  seasonNumber: number,
) {
  return (await import("./server-actions/tmdb")).fetchSeasonEpisodes(
    tvShowId,
    seasonNumber,
  )
}

export async function fetchTrailerKey(
  mediaId: number,
  mediaType: "movie" | "tv",
) {
  return (await import("./server-actions/tmdb")).fetchTrailerKey(
    mediaId,
    mediaType,
  )
}

export async function fetchMediaImages(
  mediaId: number,
  mediaType: "movie" | "tv",
) {
  return (await import("./server-actions/tmdb")).fetchMediaImages(
    mediaId,
    mediaType,
  )
}

export async function fetchMediaVideos(
  mediaId: number,
  mediaType: "movie" | "tv",
) {
  return (await import("./server-actions/tmdb")).fetchMediaVideos(
    mediaId,
    mediaType,
  )
}

export async function fetchRecommendations(
  mediaId: number,
  mediaType: "movie" | "tv",
) {
  return (await import("./server-actions/tmdb")).fetchRecommendations(
    mediaId,
    mediaType,
  )
}

export async function fetchReviews(mediaId: number, mediaType: "movie" | "tv") {
  return (await import("./server-actions/tmdb")).fetchReviews(
    mediaId,
    mediaType,
  )
}

export async function fetchWatchProviders(
  mediaId: number,
  mediaType: "movie" | "tv",
  region: import("@/lib/regions").SupportedRegionCode,
) {
  return (await import("./server-actions/tmdb")).fetchWatchProviders(
    mediaId,
    mediaType,
    region,
  )
}

export async function fetchWatchProviderCatalog(
  mediaType: "movie" | "tv",
  region: import("@/lib/regions").SupportedRegionCode,
) {
  return (await import("./server-actions/tmdb")).fetchWatchProviderCatalog(
    mediaType,
    region,
  )
}

export async function fetchCollection(collectionId: number) {
  return (await import("./server-actions/collections")).fetchCollection(
    collectionId,
  )
}

export async function fetchCollectionsBatch(collectionIds: number[]) {
  return (await import("./server-actions/collections")).fetchCollectionsBatch(
    collectionIds,
  )
}

export async function fetchMovieDetails(movieId: number) {
  return (await import("./server-actions/tmdb")).fetchMovieDetails(movieId)
}

export async function fetchFullTVDetails(tvId: number) {
  return (await import("./server-actions/tmdb")).fetchFullTVDetails(tvId)
}

export async function fetchTraktReviews(
  mediaId: number,
  mediaType: "movie" | "tv",
) {
  return (await import("./server-actions/trakt")).fetchTraktReviews(
    mediaId,
    mediaType,
  )
}

export async function fetchDiscoverHiddenGems() {
  return (await import("./server-actions/discovery")).fetchDiscoverHiddenGems()
}

export async function fetchTrendingWeek() {
  return (await import("./server-actions/discovery")).fetchTrendingWeek()
}

export type {
  SeasonEpisodeData,
  TVShowDetailsData,
} from "./server-actions/tmdb"
export type { CollectionArtworkData } from "./server-actions/collections"
