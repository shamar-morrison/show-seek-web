import {
  formatExcludedGenres,
  formatMoodGenres,
  formatMoodKeywords,
  getMoodById,
} from "@/lib/moods"
import {
  mergeWithoutGenres,
  TALK_SHOWS_WITHOUT_GENRES,
} from "@/lib/talk-shows-blocklist"
import {
  discoverMedia,
  getLanguages,
  getMovieGenres,
  getTVGenres,
  getWatchProviderList,
} from "@/lib/tmdb"
import { parseRuntimeRange } from "@/lib/discover-runtime"
import { safeParseInt, parseGenreOperator, parseIntList } from "@/lib/utils"
import type { Metadata } from "next"
import { DiscoverClient } from "./discover-client"

export const metadata: Metadata = {
  title: "Discover Movies & TV Shows to Watch | ShowSeek",
  description:
    "Browse movies and TV shows by genre, mood, and rating, then add them to your ShowSeek tracker to keep watching.",
}

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

  // Multi-select filters (comma-separated in URL, mobile parity).
  // Backwards compatible: single "?genre=28" parses to [28].
  const genreIds = mood ? [] : parseIntList(params.genre)
  const genreOperator = parseGenreOperator(params.genreOp)
  const providerIds =
    mood || parseIntList(params.provider).length === 0
      ? undefined
      : parseIntList(params.provider)
  const runtimeRange = mood
    ? null
    : parseRuntimeRange(params.minRuntime, params.maxRuntime)

  // Talk-show exclusion defaults ON (mobile parity). The server can't read
  // the client-side Firestore preference, so the client syncs it into the
  // `hideTalk=0` opt-out param (see DiscoverClient); guests get the default.
  const hideTalkShowsAndAwards = params.hideTalk !== "0"
  const moodExclusions = mood
    ? formatExcludedGenres(mood, mediaType)
    : undefined
  const talkShowExclusions =
    mediaType === "tv" && hideTalkShowsAndAwards
      ? TALK_SHOWS_WITHOUT_GENRES
      : undefined

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
        runtimeGte: runtimeRange?.[0],
        runtimeLte: runtimeRange?.[1],
        genres: mood ? undefined : genreIds.length > 0 ? genreIds : undefined,
        genreOperator,
        withGenres: mood ? formatMoodGenres(mood, mediaType) : undefined,
        withKeywords: mood ? formatMoodKeywords(mood) : undefined,
        withoutGenres: mergeWithoutGenres([moodExclusions, talkShowExclusions]),
        providers: providerIds,
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
        hideTalkShowsAndAwards,
        year: safeParseInt(params.year as string) ?? null,
        sortBy:
          (params.sort as "popularity" | "top_rated" | "newest") ||
          "popularity",
        rating: safeParseInt(params.rating as string) ?? null,
        language: (params.language as string) || null,
        runtime: runtimeRange,
        genres: genreIds,
        genreOperator,
        providers: providerIds ?? [],
      }}
    />
  )
}
