// Ported from mobile RatingService; keep acceptance rules identical for stats.
export interface RatingItem {
  id: string // mediaId for movies/TV, composite ID for episodes/seasons
  mediaType: "movie" | "tv" | "episode" | "season"
  rating: number
  ratedAt: number

  // Common metadata for all media types (movies, TV, episodes, seasons)
  title?: string
  posterPath?: string | null
  releaseDate?: string | null

  // Episode/season-specific metadata
  tvShowId?: number
  seasonNumber?: number
  episodeNumber?: number
  episodeName?: string
  tvShowName?: string
}

type RatingMediaType = RatingItem["mediaType"]

const VALID_MEDIA_TYPES: readonly RatingMediaType[] = [
  "movie",
  "tv",
  "episode",
  "season",
]

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  if (
    value &&
    typeof value === "object" &&
    "toMillis" in value &&
    typeof value.toMillis === "function"
  ) {
    const parsed = value.toMillis()
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

const getValidMediaType = (value: unknown): RatingMediaType | null => {
  return VALID_MEDIA_TYPES.includes(value as RatingMediaType)
    ? (value as RatingMediaType)
    : null
}

const getNormalizedRatingId = (
  candidateId: unknown,
  fallbackDocId: string,
  mediaType: RatingMediaType,
): string | null => {
  if (typeof candidateId === "string" && candidateId.trim() !== "") {
    return candidateId
  }

  if (!fallbackDocId) {
    return null
  }

  if (mediaType === "episode" || mediaType === "season") {
    return fallbackDocId
  }

  const prefixedId = `${mediaType}-`
  return fallbackDocId.startsWith(prefixedId)
    ? fallbackDocId.slice(prefixedId.length)
    : fallbackDocId
}

export function normalizeRatingItem(
  raw: unknown,
  fallbackDocId: string,
  source = "RatingService",
): RatingItem | null {
  if (!raw || typeof raw !== "object") {
    console.warn(
      `[${source}] Skipping invalid rating doc ${fallbackDocId}: expected object data.`,
    )
    return null
  }

  const data = raw as Record<string, unknown>
  const mediaType = getValidMediaType(data.mediaType)
  const rating = toFiniteNumber(data.rating)
  const ratedAt = toFiniteNumber(data.ratedAt)
  const tvShowIdNum = toFiniteNumber(data.tvShowId)
  const seasonNumberNum = toFiniteNumber(data.seasonNumber)
  const episodeNumberNum = toFiniteNumber(data.episodeNumber)

  if (!mediaType || rating === null || ratedAt === null) {
    console.warn(
      `[${source}] Skipping invalid rating doc ${fallbackDocId}: missing valid mediaType, rating, or ratedAt.`,
    )
    return null
  }

  const id = getNormalizedRatingId(data.id, fallbackDocId, mediaType)
  if (!id) {
    console.warn(
      `[${source}] Skipping invalid rating doc ${fallbackDocId}: missing valid id.`,
    )
    return null
  }

  return {
    id,
    mediaType,
    rating,
    ratedAt,
    ...(typeof data.title === "string" && { title: data.title }),
    ...((typeof data.posterPath === "string" || data.posterPath === null) && {
      posterPath: data.posterPath as string | null,
    }),
    ...((typeof data.releaseDate === "string" || data.releaseDate === null) && {
      releaseDate: data.releaseDate as string | null,
    }),
    ...(tvShowIdNum !== null && { tvShowId: tvShowIdNum }),
    ...(seasonNumberNum !== null && {
      seasonNumber: seasonNumberNum,
    }),
    ...(episodeNumberNum !== null && {
      episodeNumber: episodeNumberNum,
    }),
    ...(typeof data.episodeName === "string" && {
      episodeName: data.episodeName,
    }),
    ...(typeof data.tvShowName === "string" && { tvShowName: data.tvShowName }),
  }
}
