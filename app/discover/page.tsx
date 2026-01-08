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
        year: safeParseInt(params.year as string),
        sortBy:
          (params.sort as "popularity" | "top_rated" | "newest") || undefined,
        rating: safeParseInt(params.rating as string),
        language: (params.language as string) || undefined,
        genre: safeParseInt(params.genre as string),
        providers: safeParseInt(params.provider as string)
          ? [safeParseInt(params.provider as string)!]
          : undefined,
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
