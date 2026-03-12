import { DEFAULT_REGION, resolveUserRegion } from "@/lib/regions"
import { mapWithConcurrencyLimit } from "@/lib/utils/concurrency"
import type { TMDBMovieDetails, TMDBSeasonDetails, TMDBTVDetails } from "@/types/tmdb"
import type {
  FetchReleaseCalendarInput,
  ReleaseCalendarRelease,
  ReleaseCalendarTrackedItem,
  TrackedCalendarListId,
} from "@/types/release-calendar"

const ACTIVE_TV_STATUSES = new Set(["Returning Series", "In Production"])
const MAX_EPISODES_PER_SHOW = 5

export interface DedupedTrackedItem {
  id: number
  mediaType: "movie" | "tv"
  title: string
  name?: string
  posterPath: string | null
  releaseDate?: string
  firstAirDate?: string
  sourceLists: TrackedCalendarListId[]
}

export interface ReleaseCalendarSeasonRequest {
  seasonNumber: number
  showId: number
}

export interface ReleaseCalendarSeasonData {
  episodes: Array<{
    airDate: string | null
    episodeName?: string
    episodeNumber: number
    seasonNumber: number
  }>
}

interface ReleaseCalendarFetchers {
  fetchMovieDetails: (movieId: number) => Promise<TMDBMovieDetails | null>
  fetchTVDetails: (tvId: number) => Promise<TMDBTVDetails | null>
  fetchSeasonDetails: (
    tvId: number,
    seasonNumber: number,
  ) => Promise<TMDBSeasonDetails | null>
  concurrency?: number
}

function compareListIds(
  left: TrackedCalendarListId,
  right: TrackedCalendarListId,
): number {
  return left.localeCompare(right)
}

export function dedupeTrackedItems(
  items: ReleaseCalendarTrackedItem[],
): DedupedTrackedItem[] {
  const dedupedItems = new Map<string, DedupedTrackedItem>()

  for (const item of items) {
    const key = `${item.mediaType}-${item.id}`
    const existingItem = dedupedItems.get(key)

    if (existingItem) {
      if (!existingItem.sourceLists.includes(item.sourceList)) {
        existingItem.sourceLists.push(item.sourceList)
        existingItem.sourceLists.sort(compareListIds)
      }

      if (!existingItem.posterPath && item.posterPath) {
        existingItem.posterPath = item.posterPath
      }

      if (!existingItem.releaseDate && item.releaseDate) {
        existingItem.releaseDate = item.releaseDate
      }

      if (!existingItem.firstAirDate && item.firstAirDate) {
        existingItem.firstAirDate = item.firstAirDate
      }

      if (!existingItem.name && item.name) {
        existingItem.name = item.name
      }

      continue
    }

    dedupedItems.set(key, {
      id: item.id,
      mediaType: item.mediaType,
      title: item.title,
      name: item.name,
      posterPath: item.posterPath,
      releaseDate: item.releaseDate,
      firstAirDate: item.firstAirDate,
      sourceLists: [item.sourceList],
    })
  }

  return [...dedupedItems.values()].sort((left, right) => {
    if (left.mediaType !== right.mediaType) {
      return left.mediaType.localeCompare(right.mediaType)
    }

    return left.id - right.id
  })
}

function selectRegionReleaseDate(
  details: TMDBMovieDetails | null,
  region: string,
): string | null {
  if (!details?.release_dates?.results?.length) {
    return details?.release_date ?? null
  }

  const getReleaseForRegion = (regionCode: string) => {
    const regionRelease = details.release_dates?.results?.find(
      (item) => item.iso_3166_1 === regionCode,
    )

    if (!regionRelease?.release_dates?.length) {
      return null
    }

    return (
      regionRelease.release_dates.find((item) => item.type === 3) ??
      regionRelease.release_dates.find((item) => item.type === 4) ??
      regionRelease.release_dates[0] ??
      null
    )
  }

  const regionalRelease = getReleaseForRegion(region)
  if (regionalRelease?.release_date) {
    return regionalRelease.release_date.split("T")[0] ?? null
  }

  if (region !== DEFAULT_REGION) {
    const defaultRelease = getReleaseForRegion(DEFAULT_REGION)
    if (defaultRelease?.release_date) {
      return defaultRelease.release_date.split("T")[0] ?? null
    }
  }

  return details.release_date ?? null
}

export function resolveMovieReleaseDate({
  details,
  fallbackDate,
  region,
}: {
  details: TMDBMovieDetails | null
  fallbackDate?: string
  region: string
}): string | null {
  return selectRegionReleaseDate(details, region) || fallbackDate || null
}

export function getSeasonToFetch(
  details: Pick<TMDBTVDetails, "next_episode_to_air" | "status" | "seasons">,
): number | null {
  const nextSeasonNumber = details.next_episode_to_air?.season_number
  if (nextSeasonNumber && nextSeasonNumber > 0) {
    return nextSeasonNumber
  }

  if (!ACTIVE_TV_STATUSES.has(details.status)) {
    return null
  }

  const regularSeasonNumbers = details.seasons
    .map((season) => season.season_number)
    .filter((seasonNumber) => seasonNumber > 0)

  if (regularSeasonNumbers.length === 0) {
    return null
  }

  return Math.max(...regularSeasonNumbers)
}

function isFutureOrToday(dateKey: string | null | undefined, todayKey: string) {
  return !!dateKey && dateKey >= todayKey
}

export function buildReleaseCalendarSeasonRequests(
  items: DedupedTrackedItem[],
  tvDetailsById: Map<number, TMDBTVDetails | null>,
): ReleaseCalendarSeasonRequest[] {
  return items
    .filter((item) => item.mediaType === "tv")
    .map((item) => {
      const details = tvDetailsById.get(item.id)
      if (!details) {
        return null
      }

      const seasonNumber = getSeasonToFetch(details)
      if (!seasonNumber) {
        return null
      }

      return {
        showId: item.id,
        seasonNumber,
      }
    })
    .filter((request): request is ReleaseCalendarSeasonRequest => request !== null)
}

export function deriveReleaseCalendarReleases({
  items,
  movieDetailsById,
  region,
  seasonDataByShowId,
  todayKey,
  tvDetailsById,
}: {
  items: DedupedTrackedItem[]
  movieDetailsById?: Map<number, TMDBMovieDetails | null>
  region: string
  seasonDataByShowId?: Map<number, ReleaseCalendarSeasonData>
  todayKey: string
  tvDetailsById?: Map<number, TMDBTVDetails | null>
}): ReleaseCalendarRelease[] {
  const releases: ReleaseCalendarRelease[] = []
  const seenKeys = new Set<string>()
  const tvReleasesByShow = new Set<number>()

  for (const item of items) {
    if (item.mediaType !== "movie") {
      continue
    }

    const details = movieDetailsById?.get(item.id) ?? null
    const releaseDate = resolveMovieReleaseDate({
      details,
      fallbackDate: item.releaseDate,
      region,
    })

    if (!releaseDate || !isFutureOrToday(releaseDate, todayKey)) {
      continue
    }

    const uniqueKey = `movie-${item.id}`
    releases.push({
      id: item.id,
      mediaType: "movie",
      title: item.title,
      posterPath: item.posterPath,
      backdropPath: details?.backdrop_path ?? null,
      releaseDate,
      sourceLists: item.sourceLists,
      uniqueKey,
    })
    seenKeys.add(uniqueKey)
  }

  for (const item of items) {
    if (item.mediaType !== "tv") {
      continue
    }

    const details = tvDetailsById?.get(item.id) ?? null
    const seasonData = seasonDataByShowId?.get(item.id)

    if (!details || !seasonData) {
      continue
    }

    const futureEpisodes = seasonData.episodes
      .filter(
        (episode) =>
          episode.seasonNumber > 0 &&
          episode.episodeNumber > 0 &&
          isFutureOrToday(episode.airDate, todayKey),
      )
      .slice(0, MAX_EPISODES_PER_SHOW)

    for (const episode of futureEpisodes) {
      const airDate = episode.airDate
      if (!airDate) {
        continue
      }

      const uniqueKey = `tv-${item.id}-s${episode.seasonNumber}-e${episode.episodeNumber}`
      if (seenKeys.has(uniqueKey)) {
        continue
      }

      releases.push({
        id: item.id,
        mediaType: "tv",
        title: details.name || item.name || item.title,
        posterPath: item.posterPath,
        backdropPath: details.backdrop_path ?? null,
        releaseDate: airDate,
        nextEpisode: {
          seasonNumber: episode.seasonNumber,
          episodeNumber: episode.episodeNumber,
          episodeName: episode.episodeName,
        },
        sourceLists: item.sourceLists,
        uniqueKey,
      })
      seenKeys.add(uniqueKey)
    }

    if (futureEpisodes.length > 0) {
      tvReleasesByShow.add(item.id)
    }
  }

  for (const item of items) {
    if (item.mediaType !== "tv" || tvReleasesByShow.has(item.id)) {
      continue
    }

    const details = tvDetailsById?.get(item.id) ?? null
    const nextEpisode = details?.next_episode_to_air
    if (
      !nextEpisode ||
      nextEpisode.season_number <= 0 ||
      nextEpisode.episode_number <= 0 ||
      !isFutureOrToday(nextEpisode.air_date, todayKey)
    ) {
      continue
    }

    const uniqueKey = `tv-${item.id}-s${nextEpisode.season_number}-e${nextEpisode.episode_number}`
    if (seenKeys.has(uniqueKey)) {
      continue
    }

    releases.push({
      id: item.id,
      mediaType: "tv",
      title: details?.name || item.name || item.title,
      posterPath: item.posterPath,
      backdropPath: details?.backdrop_path ?? null,
      releaseDate: nextEpisode.air_date as string,
      nextEpisode: {
        seasonNumber: nextEpisode.season_number,
        episodeNumber: nextEpisode.episode_number,
        episodeName: nextEpisode.name,
      },
      sourceLists: item.sourceLists,
      uniqueKey,
    })
    seenKeys.add(uniqueKey)
  }

  releases.sort((left, right) => {
    if (left.releaseDate !== right.releaseDate) {
      return left.releaseDate.localeCompare(right.releaseDate)
    }

    if (left.mediaType !== right.mediaType) {
      return left.mediaType.localeCompare(right.mediaType)
    }

    return left.id - right.id
  })

  return releases
}

export async function buildReleaseCalendarReleases(
  input: FetchReleaseCalendarInput,
  fetchers: ReleaseCalendarFetchers,
): Promise<ReleaseCalendarRelease[]> {
  const region = resolveUserRegion(input.region)
  const dedupedItems = dedupeTrackedItems(input.items)
  const movieItems = dedupedItems.filter((item) => item.mediaType === "movie")
  const tvItems = dedupedItems.filter((item) => item.mediaType === "tv")

  const [movieDetailsResults, tvDetailsResults] = await Promise.all([
    mapWithConcurrencyLimit(
      movieItems,
      async (item) => ({
        item,
        details: await fetchers.fetchMovieDetails(item.id),
      }),
      fetchers.concurrency,
    ),
    mapWithConcurrencyLimit(
      tvItems,
      async (item) => ({
        item,
        details: await fetchers.fetchTVDetails(item.id),
      }),
      fetchers.concurrency,
    ),
  ])

  const movieDetailsById = new Map<number, TMDBMovieDetails | null>()
  for (const { item, details } of movieDetailsResults) {
    movieDetailsById.set(item.id, details)
  }

  const tvDetailsById = new Map<number, TMDBTVDetails | null>()
  for (const { item, details } of tvDetailsResults) {
    tvDetailsById.set(item.id, details)
  }

  const seasonRequests = buildReleaseCalendarSeasonRequests(
    tvItems,
    tvDetailsById,
  )

  const seasonDetailsResults = await mapWithConcurrencyLimit(
    seasonRequests,
    async (request) => ({
      seasonDetails: await fetchers.fetchSeasonDetails(
        request.showId,
        request.seasonNumber,
      ),
      showId: request.showId,
    }),
    fetchers.concurrency,
  )

  const seasonDataByShowId = new Map<number, ReleaseCalendarSeasonData>()
  for (const { showId, seasonDetails } of seasonDetailsResults) {
    if (!seasonDetails?.episodes?.length) {
      continue
    }

    seasonDataByShowId.set(showId, {
      episodes: seasonDetails.episodes.map((episode) => ({
        airDate: episode.air_date,
        episodeName: episode.name,
        episodeNumber: episode.episode_number,
        seasonNumber: episode.season_number,
      })),
    })
  }

  return deriveReleaseCalendarReleases({
    items: dedupedItems,
    movieDetailsById,
    region,
    seasonDataByShowId,
    todayKey: input.todayKey,
    tvDetailsById,
  })
}
