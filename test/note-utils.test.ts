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
})
