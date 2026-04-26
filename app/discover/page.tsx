import {
  formatExcludedGenres,
  formatMoodGenres,
  formatMoodKeywords,
  getMoodById,
} from "@/lib/moods"
import {
  discoverMedia,
  getLanguages,
  getMovieGenres,
  getTVGenres,
  getWatchProviderList,
} from "@/lib/tmdb"
import { safeParseInt } from "@/lib/utils"
import { DiscoverClient } from "./discover-client"

/**
 * Discover page - browse movies and TV shows with filters.
 * Static data (genres, languages, providers) is fetched on the server
 * and cached indefinitely since it rarely changes.
 */
export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams

  // Parse initial filter state from URL
  const mediaType = (params.type as "movie" | "tv") || "movie"
  const page = safeParseInt(params.page as string) || 1
  const moodId = typeof params.mood === "string" ? params.mood : null
  const mood = moodId ? getMoodById(moodId) : null

  // Fetch static data in parallel - these are cached indefinitely
  const [movieGenres, tvGenres, languages, providers, initialResults] =
    await Promise.all([
      getMovieGenres(),
      getTVGenres(),
      getLanguages(),
      getWatchProviderList(mediaType),
      discoverMedia({
        mediaType,
        page,
        year: mood ? undefined : safeParseInt(params.year as string),
        sortBy: mood
          ? undefined
          : ((params.sort as "popularity" | "top_rated" | "newest") ||
            undefined),
        rating: mood ? undefined : safeParseInt(params.rating as string),
        language: mood ? undefined : ((params.language as string) || undefined),
        genre: mood ? undefined : safeParseInt(params.genre as string),
        withGenres: mood ? formatMoodGenres(mood, mediaType) : undefined,
        withKeywords: mood ? formatMoodKeywords(mood) : undefined,
        withoutGenres: mood
          ? formatExcludedGenres(mood, mediaType)
          : undefined,
        providers:
          mood || !safeParseInt(params.provider as string)
            ? undefined
            : [safeParseInt(params.provider as string)!],
      }),
    ])

  return (
    <DiscoverClient
      movieGenres={movieGenres}
      tvGenres={tvGenres}
      languages={languages}
      providers={providers}
      initialResults={initialResults}
      initialFilters={{
        moodId: mood?.id ?? null,
        mediaType,
        page,
        year: safeParseInt(params.year as string) ?? null,
        sortBy:
          (params.sort as "popularity" | "top_rated" | "newest") ||
          "popularity",
        rating: safeParseInt(params.rating as string) ?? null,
        language: (params.language as string) || null,
        genre: safeParseInt(params.genre as string) ?? null,
        provider: safeParseInt(params.provider as string) ?? null,
      }}
    />
  )
}
