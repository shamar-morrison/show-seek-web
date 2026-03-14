import type { Note, NoteMediaType } from "@/types/note"

const EPISODE_NOTE_ID_PATTERN = /^episode-(\d+)-(\d+)-(\d+)$/

function isPositiveInteger(value: number | undefined): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
}

export function getNoteId(
  mediaType: NoteMediaType,
  mediaId: number,
  seasonNumber?: number,
  episodeNumber?: number,
): string {
  if (mediaType === "episode") {
    if (
      !isPositiveInteger(seasonNumber) ||
      typeof episodeNumber !== "number" ||
      !Number.isInteger(episodeNumber) ||
      episodeNumber <= 0
    ) {
      throw new Error("Episode notes require seasonNumber and episodeNumber")
    }

    return `episode-${mediaId}-${seasonNumber}-${episodeNumber}`
  }

  return `${mediaType}-${mediaId}`
}

export function parseEpisodeNoteId(noteId: string): {
  mediaId: number
  seasonNumber: number
  episodeNumber: number
} | null {
  const match = EPISODE_NOTE_ID_PATTERN.exec(noteId)
  if (!match) {
    return null
  }

  return {
    mediaId: Number(match[1]),
    seasonNumber: Number(match[2]),
    episodeNumber: Number(match[3]),
  }
}

export function getEpisodeNoteMetadata(
  note: Pick<
    Note,
    "id" | "mediaId" | "mediaType" | "seasonNumber" | "episodeNumber" | "showId"
  >,
): {
  tvShowId: number
  seasonNumber: number
  episodeNumber: number
} | null {
  if (note.mediaType !== "episode") {
    return null
  }

  const parsed = parseEpisodeNoteId(note.id)
  const seasonNumber = note.seasonNumber ?? parsed?.seasonNumber
  const episodeNumber = note.episodeNumber ?? parsed?.episodeNumber
  const tvShowId = note.showId ?? note.mediaId

  if (
    typeof tvShowId !== "number" ||
    !isPositiveInteger(seasonNumber) ||
    typeof episodeNumber !== "number" ||
    !Number.isInteger(episodeNumber) ||
    episodeNumber <= 0
  ) {
    return null
  }

  return {
    tvShowId,
    seasonNumber,
    episodeNumber,
  }
}

export function getNoteHref(
  note: Pick<
    Note,
    "id" | "mediaId" | "mediaType" | "seasonNumber" | "episodeNumber" | "showId"
  >,
): string | null {
  if (note.mediaType === "movie") {
    return `/movie/${note.mediaId}`
  }

  if (note.mediaType === "tv") {
    return `/tv/${note.mediaId}`
  }

  const episode = getEpisodeNoteMetadata(note)
  if (!episode) {
    return null
  }

  return `/tv/${episode.tvShowId}/season/${episode.seasonNumber}/episode/${episode.episodeNumber}`
}
