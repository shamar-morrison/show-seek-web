import type {
  EpisodeTrackingMetadata,
  TVShowEpisodeTracking,
  WatchedEpisode,
} from "@/types/episode-tracking"

function isTimestampLike(value: unknown): value is { toMillis: () => number } {
  return (
    typeof value === "object" &&
    value !== null &&
    "toMillis" in value &&
    typeof value.toMillis === "function"
  )
}

function toMillis(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (isTimestampLike(value)) {
    const millis = value.toMillis()
    return Number.isFinite(millis) ? millis : null
  }

  if (typeof value === "string") {
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? null : parsed
  }

  return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function normalizeEpisode(
  episodeKey: string,
  rawEpisode: unknown,
): WatchedEpisode | null {
  if (!isRecord(rawEpisode)) {
    return null
  }

  const [seasonString, episodeString] = episodeKey.split("_")
  const seasonNumber =
    typeof rawEpisode.seasonNumber === "number" &&
    Number.isFinite(rawEpisode.seasonNumber)
      ? rawEpisode.seasonNumber
      : Number(seasonString)
  const episodeNumber =
    typeof rawEpisode.episodeNumber === "number" &&
    Number.isFinite(rawEpisode.episodeNumber)
      ? rawEpisode.episodeNumber
      : Number(episodeString)

  return {
    episodeId:
      typeof rawEpisode.episodeId === "number" &&
      Number.isFinite(rawEpisode.episodeId)
        ? rawEpisode.episodeId
        : 0,
    tvShowId:
      typeof rawEpisode.tvShowId === "number" &&
      Number.isFinite(rawEpisode.tvShowId)
        ? rawEpisode.tvShowId
        : 0,
    seasonNumber: Number.isFinite(seasonNumber) ? seasonNumber : 0,
    episodeNumber: Number.isFinite(episodeNumber) ? episodeNumber : 0,
    watchedAt: toMillis(rawEpisode.watchedAt) ?? 0,
    episodeName:
      typeof rawEpisode.episodeName === "string" ? rawEpisode.episodeName : "",
    episodeAirDate:
      typeof rawEpisode.episodeAirDate === "string"
        ? rawEpisode.episodeAirDate
        : null,
  }
}

type NormalizedMetadata = Omit<EpisodeTrackingMetadata, "lastUpdated"> & {
  lastUpdated: number | null
}

function normalizeNextEpisode(
  rawNextEpisode: unknown,
): EpisodeTrackingMetadata["nextEpisode"] | undefined {
  if (rawNextEpisode === null) {
    return null
  }

  if (!isRecord(rawNextEpisode)) {
    return undefined
  }

  const season = rawNextEpisode.season
  const episode = rawNextEpisode.episode

  if (
    typeof season !== "number" ||
    !Number.isFinite(season) ||
    typeof episode !== "number" ||
    !Number.isFinite(episode)
  ) {
    return undefined
  }

  return {
    season,
    episode,
    title: typeof rawNextEpisode.title === "string" ? rawNextEpisode.title : "",
    airDate:
      typeof rawNextEpisode.airDate === "string"
        ? rawNextEpisode.airDate
        : null,
  }
}

function normalizeMetadata(rawMetadata: unknown): NormalizedMetadata {
  const metadata = isRecord(rawMetadata) ? rawMetadata : {}
  const totalEpisodes = metadata.totalEpisodes
  const avgRuntime = metadata.avgRuntime
  const nextEpisode = normalizeNextEpisode(metadata.nextEpisode)

  return {
    tvShowName:
      typeof metadata.tvShowName === "string" ? metadata.tvShowName : "",
    posterPath:
      typeof metadata.posterPath === "string" ? metadata.posterPath : null,
    lastUpdated: toMillis(metadata.lastUpdated),
    ...(typeof totalEpisodes === "number" && Number.isFinite(totalEpisodes)
      ? { totalEpisodes }
      : {}),
    ...(typeof avgRuntime === "number" && Number.isFinite(avgRuntime)
      ? { avgRuntime }
      : {}),
    ...(nextEpisode !== undefined ? { nextEpisode } : {}),
  }
}

export function normalizeEpisodeTrackingDoc(
  rawData: unknown,
): TVShowEpisodeTracking {
  const data = isRecord(rawData) ? rawData : {}
  const rawEpisodes = isRecord(data.episodes) ? data.episodes : {}
  const episodes = Object.fromEntries(
    Object.entries(rawEpisodes)
      .map(([episodeKey, episode]) => [
        episodeKey,
        normalizeEpisode(episodeKey, episode),
      ])
      .filter((entry): entry is [string, WatchedEpisode] => entry[1] !== null),
  )

  const metadata = normalizeMetadata(data.metadata)

  if (metadata.lastUpdated == null) {
    metadata.lastUpdated = Math.max(
      0,
      ...Object.values(episodes).map((episode) => episode.watchedAt),
    )
  }

  const normalizedMetadata: EpisodeTrackingMetadata = {
    ...metadata,
    lastUpdated: metadata.lastUpdated ?? 0,
  }

  return {
    episodes,
    metadata: normalizedMetadata,
  }
}
