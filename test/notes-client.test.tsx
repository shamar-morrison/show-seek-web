import { NotesClient } from "@/app/lists/notes/notes-client"
import { render, screen } from "@/test/utils"
import userEvent from "@testing-library/user-event"
import { Timestamp } from "firebase/firestore"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Note } from "@/types/note"

const mocks = vi.hoisted(() => ({
  removeNote: vi.fn(),
  saveNote: vi.fn(),
  notes: new Map(),
  preferences: {
    showOriginalTitles: true,
  },
  toastSuccess: vi.fn(),
  lastModalProps: null as {
    media: {
      original_title?: string
      original_name?: string
      season_number?: number
      episode_number?: number
    }
  } | null,
}))

function createNote(overrides: Partial<Note>): Note {
  return {
    id: "movie-123",
    userId: "user-1",
    mediaId: 123,
    mediaType: "movie",
    content: "Masterpiece",
    mediaTitle: "Spirited Away",
    originalTitle: "Sen to Chihiro no Kamikakushi",
    posterPath: null,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    ...overrides,
  }
}

vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({
    user: { uid: "user-1" },
    loading: false,
  }),
}))

vi.mock("@/hooks/use-notes", () => ({
  useNotes: () => ({
    notes: mocks.notes,
    loading: false,
    removeNote: mocks.removeNote,
    saveNote: mocks.saveNote,
  }),
}))

vi.mock("@/hooks/use-preferences", () => ({
  usePreferences: () => ({
    preferences: mocks.preferences,
  }),
}))

vi.mock("@/components/note-card", () => ({
  NoteCard: ({
    note,
    onEdit,
    onDelete,
  }: {
    note: {
      id: string
      mediaType: string
      content: string
      mediaTitle: string
      originalTitle?: string
    }
    onEdit: (note: unknown) => void
    onDelete: (note: unknown) => void
  }) => {
    const displayTitle =
      (mocks.preferences.showOriginalTitles && note.originalTitle) ||
      note.mediaTitle

    return (
      <div
        data-testid="note-card"
        data-note-id={note.id}
        data-media-type={note.mediaType}
      >
        <span>{displayTitle}</span>
        <span>{note.content}</span>
        <button type="button" onClick={() => onEdit(note)}>
          Edit note
        </button>
        <button type="button" onClick={() => onDelete(note)}>
          Delete note
        </button>
      </div>
    )
  },
}))

vi.mock("@/components/notes-modal", () => ({
  NotesModal: (props: {
    isOpen: boolean
    media: {
      original_title?: string
      original_name?: string
      season_number?: number
      episode_number?: number
    }
  }) => {
    mocks.lastModalProps = props
    return props.isOpen ? (
      <div
        data-testid="notes-modal"
        data-original-title={
          props.media.original_title ?? props.media.original_name ?? ""
        }
        data-season-number={props.media.season_number ?? ""}
        data-episode-number={props.media.episode_number ?? ""}
      />
    ) : null
  },
}))

vi.mock("@/components/ui/filter-sort", () => ({
  FilterSort: ({
    onSortChange,
  }: {
    onSortChange: (state: { field: string; direction: string }) => void
  }) => (
    <button
      type="button"
      onClick={() => onSortChange({ field: "title", direction: "asc" })}
    >
      Sort title
    </button>
  ),
}))

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => mocks.toastSuccess(...args),
    error: vi.fn(),
  },
}))

describe("NotesClient", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.lastModalProps = null
    mocks.saveNote.mockResolvedValue(undefined)
    mocks.notes = new Map([
      [
        "movie-123",
        createNote({}),
      ],
    ])
  })

  it("renders the preferred title, searches original titles, and rehydrates modal media", async () => {
    const user = userEvent.setup()

    render(<NotesClient />)

    expect(screen.getByText("Sen to Chihiro no Kamikakushi")).toBeInTheDocument()

    await user.type(
      screen.getByPlaceholderText(
        "Search by media title, original title, or note content...",
      ),
      "Chihiro",
    )

    expect(screen.getByText("Sen to Chihiro no Kamikakushi")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Edit note" }))

    expect(screen.getByTestId("notes-modal")).toHaveAttribute(
      "data-original-title",
      "Sen to Chihiro no Kamikakushi",
    )
    expect(mocks.lastModalProps?.media.original_title).toBe(
      "Sen to Chihiro no Kamikakushi",
    )
  })

  it("sorts notes alphabetically by the displayed title", async () => {
    const user = userEvent.setup()

    mocks.notes = new Map([
      [
        "movie-123",
        createNote({}),
      ],
      [
        "movie-456",
        createNote({
          id: "movie-456",
          mediaId: 456,
          content: "Excellent",
          mediaTitle: "Your Name",
          originalTitle: "Kimi no Na wa.",
        }),
      ],
    ])

    render(<NotesClient />)

    await user.click(screen.getByRole("button", { name: "Sort title" }))

    const cards = screen.getAllByTestId("note-card")
    expect(cards[0]).toHaveTextContent("Kimi no Na wa.")
    expect(cards[1]).toHaveTextContent("Sen to Chihiro no Kamikakushi")
  })

  it("shows all notes by default and filters between movies, tv shows, and episodes", async () => {
    const user = userEvent.setup()

    mocks.notes = new Map([
      [
        "movie-123",
        createNote({}),
      ],
      [
        "tv-456",
        createNote({
          id: "tv-456",
          mediaId: 456,
          mediaType: "tv",
          mediaTitle: "Severance",
          originalTitle: undefined,
          content: "Great mystery",
        }),
      ],
      [
        "episode-456-1-1",
        createNote({
          id: "episode-456-1-1",
          mediaId: 456,
          mediaType: "episode",
          mediaTitle: "Good News About Hell",
          originalTitle: undefined,
          content: "Pilot episode note",
          seasonNumber: 1,
          episodeNumber: 1,
          showId: 456,
        }),
      ],
    ])

    render(<NotesClient />)

    expect(screen.getAllByTestId("note-card")).toHaveLength(3)

    await user.click(screen.getByRole("button", { name: /Movies/i }))
    expect(screen.getAllByTestId("note-card")).toHaveLength(1)
    expect(screen.getByTestId("note-card")).toHaveAttribute(
      "data-media-type",
      "movie",
    )

    await user.click(screen.getByRole("button", { name: /TV Shows/i }))
    expect(screen.getAllByTestId("note-card")).toHaveLength(1)
    expect(screen.getByTestId("note-card")).toHaveAttribute(
      "data-media-type",
      "tv",
    )

    await user.click(screen.getByRole("button", { name: /Episodes/i }))
    expect(screen.getAllByTestId("note-card")).toHaveLength(1)
    expect(screen.getByTestId("note-card")).toHaveAttribute(
      "data-media-type",
      "episode",
    )
  })

  it("applies search within the active tab", async () => {
    const user = userEvent.setup()

    mocks.notes = new Map([
      [
        "movie-123",
        createNote({
          content: "Pilot on a plane",
        }),
      ],
      [
        "episode-456-1-1",
        createNote({
          id: "episode-456-1-1",
          mediaId: 456,
          mediaType: "episode",
          mediaTitle: "Pilot",
          originalTitle: undefined,
          content: "Pilot episode note",
          seasonNumber: 1,
          episodeNumber: 1,
          showId: 456,
        }),
      ],
    ])

    render(<NotesClient />)

    await user.click(screen.getByRole("button", { name: /Episodes/i }))
    await user.type(
      screen.getByPlaceholderText(
        "Search by media title, original title, or note content...",
      ),
      "plane",
    )

    expect(screen.getByText('No notes match "plane"')).toBeInTheDocument()
    expect(screen.queryByTestId("note-card")).not.toBeInTheDocument()
  })

  it("shows a tab-specific empty state when the selected tab has no notes", async () => {
    const user = userEvent.setup()

    mocks.notes = new Map([
      [
        "movie-123",
        createNote({}),
      ],
    ])

    render(<NotesClient />)

    await user.click(screen.getByRole("button", { name: /Episodes/i }))

    expect(screen.getByText("No episode notes yet")).toBeInTheDocument()
    expect(
      screen.getByText("Add notes to episode detail pages to see them here."),
    ).toBeInTheDocument()
  })

  it("restores deleted notes from the success toast action", async () => {
    const user = userEvent.setup()

    render(<NotesClient />)

    await user.click(screen.getByRole("button", { name: "Delete note" }))

    const toastOptions = mocks.toastSuccess.mock.calls[0]?.[1] as
      | { action?: { onClick: () => void | Promise<void> } }
      | undefined

    await toastOptions?.action?.onClick()

    expect(mocks.saveNote).toHaveBeenCalledWith(
      "movie",
      123,
      "Masterpiece",
      "Spirited Away",
      "Sen to Chihiro no Kamikakushi",
      null,
    )
  })
})
