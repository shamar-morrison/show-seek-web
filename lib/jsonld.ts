/**
 * JSON-LD structured data builders (schema.org).
 *
 * Pure functions — safe for server components and unit tests.
 * Field names verified against the schema.org spec (Movie, TVSeries,
 * WebSite/SearchAction). See test/jsonld.test.ts for conformance checks.
 */

import type {
  CastMember,
  CrewMember,
  TMDBMovieDetails,
  TMDBTVDetails,
} from "@/types/tmdb"
import { buildImageUrl } from "@/lib/tmdb"

const SITE_URL = "https://show-seek.app"
const CONTEXT = "https://schema.org"

const TOP_BILLED_CAST_COUNT = 5

function personSchema(name: string) {
  return { "@type": "Person", name }
}

function aggregateRatingSchema(voteAverage: number, voteCount: number) {
  if (!voteCount || voteCount <= 0) return undefined
  return {
    "@type": "AggregateRating",
    ratingValue: Math.round(voteAverage * 10) / 10,
    ratingCount: voteCount,
    bestRating: 10,
  }
}

function trailerSchema(title: string, trailerKey: string | null, thumbnailUrl: string | null) {
  if (!trailerKey) return undefined
  return {
    "@type": "VideoObject",
    name: `${title} Trailer`,
    embedUrl: `https://www.youtube.com/embed/${trailerKey}`,
    ...(thumbnailUrl && { thumbnailUrl }),
  }
}

function topBilledCast(cast: CastMember[] | undefined) {
  if (!cast || cast.length === 0) return undefined
  const actors = [...cast]
    .sort((a, b) => a.order - b.order)
    .slice(0, TOP_BILLED_CAST_COUNT)
    .map((member) => personSchema(member.name))
  return actors.length > 0 ? actors : undefined
}

function directors(crew: CrewMember[] | undefined) {
  if (!crew || crew.length === 0) return undefined
  const names = crew
    .filter((member) => member.department === "Directing" && member.job === "Director")
    .map((member) => personSchema(member.name))
  return names.length > 0 ? names : undefined
}

/**
 * WebSite schema with SearchAction for the homepage.
 * Search target mirrors the internal search route (/search?q=...).
 */
export function websiteSchema() {
  return {
    "@context": CONTEXT,
    "@type": "WebSite",
    name: "ShowSeek",
    url: `${SITE_URL}/`,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  }
}

/**
 * Movie schema for /movie/[id] pages, including credits-derived fields
 * (actor/director).
 */
export function movieDetailSchema(
  movie: TMDBMovieDetails,
  trailerKey: string | null,
) {
  const imageUrl =
    buildImageUrl(movie.poster_path, "original") ??
    buildImageUrl(movie.backdrop_path, "original")
  const runtime =
    typeof movie.runtime === "number" && movie.runtime > 0
      ? `PT${movie.runtime}M`
      : undefined
  return {
    "@context": CONTEXT,
    "@type": "Movie",
    name: movie.title,
    description: movie.overview || undefined,
    url: `${SITE_URL}/movie/${movie.id}`,
    ...(imageUrl && { image: imageUrl }),
    ...(movie.release_date && { datePublished: movie.release_date }),
    ...(movie.genres.length > 0 && {
      genre: movie.genres.map((genre) => genre.name),
    }),
    ...(movie.original_language && { inLanguage: movie.original_language }),
    ...(runtime && { duration: runtime }),
    ...(movie.production_companies.length > 0 && {
      productionCompany: movie.production_companies.map((company) => ({
        "@type": "Organization",
        name: company.name,
      })),
    }),
    ...optionalFields({
      aggregateRating: aggregateRatingSchema(
        movie.vote_average,
        movie.vote_count,
      ),
      actor: topBilledCast(movie.credits?.cast),
      director: directors(movie.credits?.crew),
      trailer: trailerSchema(
        movie.title,
        trailerKey,
        buildImageUrl(movie.backdrop_path, "w1280"),
      ),
    }),
  }
}

/**
 * TVSeries schema for /tv/[id] pages.
 */
export function tvSeriesDetailSchema(
  tvShow: TMDBTVDetails,
  trailerKey: string | null,
) {
  const imageUrl =
    buildImageUrl(tvShow.poster_path, "original") ??
    buildImageUrl(tvShow.backdrop_path, "original")
  return {
    "@context": CONTEXT,
    "@type": "TVSeries",
    name: tvShow.name,
    description: tvShow.overview || undefined,
    url: `${SITE_URL}/tv/${tvShow.id}`,
    ...(imageUrl && { image: imageUrl }),
    ...(tvShow.first_air_date && { datePublished: tvShow.first_air_date }),
    ...(tvShow.genres.length > 0 && {
      genre: tvShow.genres.map((genre) => genre.name),
    }),
    ...(tvShow.original_language && { inLanguage: tvShow.original_language }),
    ...(tvShow.number_of_seasons > 0 && {
      numberOfSeasons: tvShow.number_of_seasons,
    }),
    ...(tvShow.number_of_episodes > 0 && {
      numberOfEpisodes: tvShow.number_of_episodes,
    }),
    ...(tvShow.production_companies.length > 0 && {
      productionCompany: tvShow.production_companies.map((company) => ({
        "@type": "Organization",
        name: company.name,
      })),
    }),
    ...(tvShow.created_by.length > 0 && {
      creator: tvShow.created_by.map((creator) => personSchema(creator.name)),
    }),
    ...optionalFields({
      aggregateRating: aggregateRatingSchema(
        tvShow.vote_average,
        tvShow.vote_count,
      ),
      actor: topBilledCast(tvShow.credits?.cast),
      trailer: trailerSchema(
        tvShow.name,
        trailerKey,
        buildImageUrl(tvShow.backdrop_path, "w1280"),
      ),
    }),
  }
}

interface ItemListItem {
  id: number
  media_type: string
  title?: string | null
  name?: string | null
}

/**
 * ItemList schema for browse pages (/trending-tv, /popular-movies, ...).
 * Lists the titles shown on the page with links to their detail pages.
 * Non-title entries (e.g. person results) are skipped.
 */
export function itemListSchema(input: {
  name: string
  description: string
  url: string
  items: ItemListItem[]
}) {
  const titles = input.items.filter(
    (item): item is ItemListItem & { media_type: "movie" | "tv" } =>
      item.media_type === "movie" || item.media_type === "tv",
  )
  return {
    "@context": CONTEXT,
    "@type": "ItemList",
    name: input.name,
    description: input.description,
    url: input.url,
    numberOfItems: titles.length,
    itemListElement: titles.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.title || item.name || `Title ${item.id}`,
      url: `${SITE_URL}/${item.media_type}/${item.id}`,
    })),
  }
}

/**
 * Spread helper that drops undefined values so the JSON-LD payload never
 * contains explicit nulls/undefined (which validators flag).
 */
function optionalFields<T extends Record<string, unknown>>(fields: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined),
  ) as Partial<T>
}
