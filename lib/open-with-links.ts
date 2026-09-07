/**
 * "Open with" external service links for movie/TV detail screens.
 * Ported from `show-seek/src/utils/openWithLinks.ts` — keep URL shapes in
 * sync with mobile. Pure string builders: no network, no storage.
 */

export type OpenWithServiceId =
  | "imdb"
  | "trakt"
  | "tmdb"
  | "letterboxd"
  | "rottenTomatoes"
  | "metacritic"
  | "wikipedia"
  | "webSearch"

export interface BuildOpenWithUrlParams {
  serviceId: OpenWithServiceId
  mediaType: "movie" | "tv"
  mediaId: number
  title: string
  year?: string | number | null
  imdbId?: string | null
  traktSlug?: string | null
}

export const OPEN_WITH_SERVICES: ReadonlyArray<{
  id: OpenWithServiceId
  label: string
}> = [
  { id: "imdb", label: "IMDb" },
  { id: "trakt", label: "Trakt" },
  { id: "tmdb", label: "TMDB" },
  { id: "letterboxd", label: "Letterboxd" },
  { id: "rottenTomatoes", label: "Rotten Tomatoes" },
  { id: "metacritic", label: "Metacritic" },
  { id: "wikipedia", label: "Wikipedia" },
  { id: "webSearch", label: "Web Search" },
]

function normalizeQuery(title: string, year?: string | number | null): string {
  const safeTitle = title.trim()
  const safeYear = year ? String(year).trim() : ""
  return safeYear ? `${safeTitle} ${safeYear}` : safeTitle
}

export function buildOpenWithFallbackUrl({
  serviceId,
  mediaType,
  title,
  year,
}: Omit<
  BuildOpenWithUrlParams,
  "mediaId" | "imdbId" | "traktSlug"
>): string {
  const query = encodeURIComponent(normalizeQuery(title, year))
  // app.trakt.tv search modes: "movie" for movies, "show" for TV shows.
  const traktMode = mediaType === "movie" ? "movie" : "show"

  switch (serviceId) {
    case "imdb":
      return `https://www.imdb.com/find/?q=${query}&s=tt`
    case "trakt":
      return `https://app.trakt.tv/search?m=${traktMode}&q=${query}`
    case "tmdb":
      return `https://www.themoviedb.org/search/${mediaType}?query=${query}`
    case "letterboxd":
      return `https://letterboxd.com/search/${query}/`
    case "rottenTomatoes":
      return `https://www.rottentomatoes.com/search?search=${query}`
    case "metacritic":
      return `https://www.metacritic.com/search/${query}/`
    case "wikipedia":
      return `https://en.wikipedia.org/w/index.php?search=${query}`
    case "webSearch":
      return `https://www.google.com/search?q=${query}`
  }
}

export function buildOpenWithUrl(params: BuildOpenWithUrlParams): string {
  const { serviceId, mediaType, mediaId, imdbId, traktSlug } = params
  const tmdbPath = mediaType === "movie" ? "movie" : "tv"

  if (serviceId === "imdb" && imdbId) {
    return `https://www.imdb.com/title/${imdbId}/`
  }

  if (serviceId === "trakt" && traktSlug) {
    const traktType = mediaType === "movie" ? "movies" : "shows"
    return `https://trakt.tv/${traktType}/${traktSlug}`
  }

  if (serviceId === "tmdb") {
    return `https://www.themoviedb.org/${tmdbPath}/${mediaId}`
  }

  return buildOpenWithFallbackUrl(params)
}
