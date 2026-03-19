"use server"

import { discoverMedia, getTrendingMedia } from "@/lib/tmdb"
import type { TMDBMedia } from "@/types/tmdb"

/**
 * Fetch hidden gems (high-rated, low-popularity movies).
 * Used for the "Hidden Gems" section in For You recommendations.
 */
export async function fetchDiscoverHiddenGems(): Promise<TMDBMedia[]> {
  try {
    const response = await discoverMedia({
      mediaType: "movie",
      sortBy: "top_rated",
      rating: 7.5,
    })

    return response.results
      .filter((media) => media.popularity < 50)
      .slice(0, 20)
      .map((media) => ({ ...media, media_type: "movie" as const }))
  } catch (error) {
    console.error("Server Action: Failed to fetch hidden gems", error)
    return []
  }
}

/**
 * Fetch trending content for the week.
 * Used as fallback in For You recommendations when user has insufficient data.
 */
export async function fetchTrendingWeek(): Promise<TMDBMedia[]> {
  try {
    return await getTrendingMedia("week")
  } catch (error) {
    console.error("Server Action: Failed to fetch weekly trending", error)
    return []
  }
}
