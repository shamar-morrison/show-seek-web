import { DEFAULT_REGION, resolveUserRegion } from "@/lib/regions"
import type { TMDBMovieDetails, TMDBSeasonDetails, TMDBTVDetails } from "@/types/tmdb"
import type {
  FetchReleaseCalendarInput,
  ReleaseCalendarRelease,
  ReleaseCalendarTrackedItem,
  TrackedCalendarListId,
} from "@/types/release-calendar"

const ACTIVE_TV_STATUSES = new Set(["Returning Series", "In Production"])
const MAX_EPISODES_PER_SHOW = 5
const DEFAULT_CONCURRENCY = 5

interface DedupedTrackedItem {
  id: number
  mediaType: "movie" | "tv"
  title: string
  name?: string
  posterPath: string | null
  releaseDate?: string
  firstAirDate?: string
  sourceLists: TrackedCalendarListId[]
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

function dedupeTrackedItems(
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

async function mapWithConcurrencyLimit<T, TResult>(
  items: readonly T[],
  worker: (item: T) => Promise<TResult>,
  concurrency: number = DEFAULT_CONCURRENCY,
): Promise<TResult[]> {
  if (items.length === 0) {
    return []
  }

  const results = new Array<TResult>(items.length)
  let nextIndex = 0
  const workerCount = Math.min(items.length, Math.max(1, concurrency))

  async function run(): Promise<void> {
    if (nextIndex >= items.length) {
      return
    }

    const currentIndex = nextIndex
    nextIndex += 1
    results[currentIndex] = await worker(items[currentIndex] as T)
    await run()
  }

  await Promise.all(Array.from({ length: workerCount }, () => run()))

  return results
}

function isFutureOrToday(dateKey: string | null | undefined, todayKey: string) {
  return !!dateKey && dateKey >= todayKey
}

export async function buildReleaseCalendarReleases(
  input: FetchReleaseCalendarInput,
  fetchers: ReleaseCalendarFetchers,
): Promise<ReleaseCalendarRelease[]> {
  const region = resolveUserRegion(input.region)
  const dedupedItems = dedupeTrackedItems(input.items)
  const movieItems = dedupedItems.filter((item) => item.mediaType === "movie")
  const tvItems = dedupedItems.filter((item) => item.mediaType === "tv")
  const concurrency = fetchers.concurrency ?? DEFAULT_CONCURRENCY

  const [movieDetailsResults, tvDetailsResults] = await Promise.all([
    mapWithConcurrencyLimit(
      movieItems,
      async (item) => ({
        item,
        details: await fetchers.fetchMovieDetails(item.id),
      }),
      concurrency,
    ),
    mapWithConcurrencyLimit(
      tvItems,
      async (item) => ({
        item,
        details: await fetchers.fetchTVDetails(item.id),
      }),
      concurrency,
    ),
  ])

  const seasonRequests = tvDetailsResults
    .map(({ item, details }) => {
      if (!details) {
        return null
      }

      const seasonNumber = getSeasonToFetch(details)
      if (!seasonNumber) {
        return null
      }

      return {
        item,
        details,
        seasonNumber,
      }
    })
    .filter((request): request is NonNullable<typeof request> => request !== null)

  const seasonDetailsResults = await mapWithConcurrencyLimit(
    seasonRequests,
    async (request) => ({
      ...request,
      seasonDetails: await fetchers.fetchSeasonDetails(
        request.item.id,
        request.seasonNumber,
      ),
    }),
    concurrency,
  )

  const releases: ReleaseCalendarRelease[] = []
  const tvReleasesByShow = new Set<number>()

  for (const { item, details } of movieDetailsResults) {
    const releaseDate = resolveMovieReleaseDate({
      details,
      fallbackDate: item.releaseDate,
      region,
    })

    if (!releaseDate || !isFutureOrToday(releaseDate, input.todayKey)) {
      continue
    }

    releases.push({
      id: item.id,
      mediaType: "movie",
      title: item.title,
      posterPath: item.posterPath,
      backdropPath: details?.backdrop_path ?? null,
      releaseDate,
      sourceLists: item.sourceLists,
      uniqueKey: `movie-${item.id}`,
    })
  }

  for (const { item, details, seasonDetails } of seasonDetailsResults) {
    const futureEpisodes =
      seasonDetails?.episodes
        ?.filter(
          (episode) =>
            episode.season_number > 0 &&
            episode.episode_number > 0 &&
            isFutureOrToday(episode.air_date, input.todayKey),
        )
        .slice(0, MAX_EPISODES_PER_SHOW) ?? []

    for (const episode of futureEpisodes) {
      releases.push({
        id: item.id,
        mediaType: "tv",
        title: details.name || item.name || item.title,
        posterPath: item.posterPath,
        backdropPath: details.backdrop_path ?? null,
        releaseDate: episode.air_date as string,
        nextEpisode: {
          seasonNumber: episode.season_number,
          episodeNumber: episode.episode_number,
          episodeName: episode.name,
        },
        sourceLists: item.sourceLists,
        uniqueKey: `tv-${item.id}-s${episode.season_number}-e${episode.episode_number}`,
      })
    }

    if (futureEpisodes.length > 0) {
      tvReleasesByShow.add(item.id)
    }
  }

  for (const { item, details } of tvDetailsResults) {
    if (!details || tvReleasesByShow.has(item.id)) {
      continue
    }

    const nextEpisode = details.next_episode_to_air
    if (
      !nextEpisode ||
      nextEpisode.season_number <= 0 ||
      nextEpisode.episode_number <= 0 ||
      !isFutureOrToday(nextEpisode.air_date, input.todayKey)
    ) {
      continue
    }

    releases.push({
      id: item.id,
      mediaType: "tv",
      title: details.name || item.name || item.title,
      posterPath: item.posterPath,
      backdropPath: details.backdrop_path ?? null,
      releaseDate: nextEpisode.air_date as string,
      nextEpisode: {
        seasonNumber: nextEpisode.season_number,
        episodeNumber: nextEpisode.episode_number,
        episodeName: nextEpisode.name,
      },
      sourceLists: item.sourceLists,
      uniqueKey: `tv-${item.id}-s${nextEpisode.season_number}-e${nextEpisode.episode_number}`,
    })
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
