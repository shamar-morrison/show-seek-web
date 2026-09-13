import {
  getEpisodeNoteMetadata,
  getNoteHref,
  getNoteId,
} from "@/lib/note-utils"
import type { Note } from "@/types/note"
import { Timestamp } from "firebase/firestore"
import { describe, expect, it } from "vitest"

function createNote(overrides: Partial<Note>): Note {
  return {
    id: "movie-1",
    userId: "user-1",
    mediaType: "movie",
    mediaId: 1,
    content: "Test note",
    mediaTitle: "Test Title",
    posterPath: null,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    ...overrides,
  }
}

describe("note utils", () => {
  it("builds stable note ids for movie, tv, and episode notes", () => {
    expect(getNoteId("movie", 10)).toBe("movie-10")
    expect(getNoteId("tv", 42)).toBe("tv-42")
    expect(getNoteId("episode", 100, 2, 3)).toBe("episode-100-2-3")
  })

  it("builds season note ids from the show id and season number", () => {
    expect(getNoteId("season", 100, 2)).toBe("season-100-2")
    expect(getNoteId("season", 100, 0)).toBe("season-100-0")
  })

  it("throws when a season note id is requested without a season number", () => {
    expect(() => getNoteId("season", 100)).toThrow(
      "Season notes require seasonNumber",
    )
  })

  it("throws when an episode note id is requested without season or episode metadata", () => {
    expect(() => getNoteId("episode", 100)).toThrow(
      "Episode notes require seasonNumber and episodeNumber",
    )
  })

  it("navigates episode notes with explicit show metadata", () => {
    const note = createNote({
      id: "episode-100-2-3",
      mediaType: "episode",
      mediaId: 100,
      showId: 999,
      seasonNumber: 2,
      episodeNumber: 3,
    })

    expect(getNoteHref(note)).toBe("/tv/999/season/2/episode/3")
  })

  it("falls back to the episode note id when season and episode fields are missing", () => {
    const note = createNote({
      id: "episode-100-2-3",
      mediaType: "episode",
      mediaId: 100,
      showId: undefined,
      seasonNumber: undefined,
      episodeNumber: undefined,
    })

    expect(getEpisodeNoteMetadata(note)).toEqual({
      tvShowId: 100,
      seasonNumber: 2,
      episodeNumber: 3,
    })
    expect(getNoteHref(note)).toBe("/tv/100/season/2/episode/3")
  })

  it("returns null instead of a wrong route for invalid episode notes", () => {
    const note = createNote({
      id: "episode-bad",
      mediaType: "episode",
      mediaId: 100,
      seasonNumber: undefined,
      episodeNumber: undefined,
    })

    expect(getEpisodeNoteMetadata(note)).toBeNull()
    expect(getNoteHref(note)).toBeNull()
  })

  it("navigates season notes to the season details page", () => {
    const note = createNote({
      id: "season-100-2",
      mediaType: "season",
      mediaId: 100,
      showId: 100,
      seasonNumber: 2,
    })

    expect(getNoteHref(note)).toBe("/tv/100/season/2")
  })

  it("falls back to the media id when a season note has no show id", () => {
    const note = createNote({
      id: "season-100-2",
      mediaType: "season",
      mediaId: 100,
      showId: undefined,
      seasonNumber: 2,
    })

    expect(getNoteHref(note)).toBe("/tv/100/season/2")
  })

  it("returns null for season notes without a season number", () => {
    const note = createNote({
      id: "season-100-x",
      mediaType: "season",
      mediaId: 100,
      seasonNumber: undefined,
    })

    expect(getNoteHref(note)).toBeNull()
  })
})
