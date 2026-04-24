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
    typeof rawEpisode.seasonNumber === "number"
      ? rawEpisode.seasonNumber
      : Number(seasonString)
  const episodeNumber =
    typeof rawEpisode.episodeNumber === "number"
      ? rawEpisode.episodeNumber
      : Number(episodeString)

  return {
    ...rawEpisode,
    episodeId:
      typeof rawEpisode.episodeId === "number" ? rawEpisode.episodeId : 0,
    tvShowId: typeof rawEpisode.tvShowId === "number" ? rawEpisode.tvShowId : 0,
    seasonNumber: Number.isFinite(seasonNumber) ? seasonNumber : 0,
    episodeNumber: Number.isFinite(episodeNumber) ? episodeNumber : 0,
    watchedAt: toMillis(rawEpisode.watchedAt) ?? 0,
    episodeName:
      typeof rawEpisode.episodeName === "string" ? rawEpisode.episodeName : "",
    episodeAirDate:
      typeof rawEpisode.episodeAirDate === "string"
        ? rawEpisode.episodeAirDate
        : null,
  } as WatchedEpisode
}

function normalizeMetadata(rawMetadata: unknown): EpisodeTrackingMetadata {
  const metadata = isRecord(rawMetadata) ? rawMetadata : {}

  return {
    ...metadata,
    tvShowName:
      typeof metadata.tvShowName === "string" ? metadata.tvShowName : "",
    posterPath:
      typeof metadata.posterPath === "string" ? metadata.posterPath : null,
    lastUpdated: toMillis(metadata.lastUpdated) ?? 0,
  } as EpisodeTrackingMetadata
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

  if (!metadata.lastUpdated) {
    metadata.lastUpdated = Math.max(
      0,
      ...Object.values(episodes).map((episode) => episode.watchedAt),
    )
  }

  return {
    episodes,
    metadata,
  }
}
