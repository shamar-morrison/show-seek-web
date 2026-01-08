"use client"

import { NoteCard } from "@/components/note-card"
import { NotesModal } from "@/components/notes-modal"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { FilterSort, SortState } from "@/components/ui/filter-sort"
import { SearchInput } from "@/components/ui/search-input"
import { useAuth } from "@/context/auth-context"
import { useNotes } from "@/hooks/use-notes"
import type { Note } from "@/types/note"
import {
  Loading03Icon,
  Note01Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useCallback, useMemo, useState } from "react"
import { toast } from "sonner"

// Sort field options for notes
const SORT_FIELDS = [
  { value: "updatedAt", label: "Last Updated" },
  { value: "createdAt", label: "Date Added" },
  { value: "title", label: "Alphabetically" },
]

/**
 * NotesClient Component
 * Client component for the notes page with search, sort, grid, and modals
 */
export function NotesClient() {
  const { user, loading: authLoading } = useAuth()
  const { notes, loading: notesLoading, removeNote } = useNotes()
  const [searchQuery, setSearchQuery] = useState("")
  const [editingNote, setEditingNote] = useState<Note | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Sort state
  const [sortState, setSortState] = useState<SortState>({
    field: "updatedAt",
    direction: "desc",
  })

  // Convert notes Map to array
  const notesArray = useMemo(() => Array.from(notes.values()), [notes])

  // Filter notes by search query (matches title or content)
  const filteredNotes = useMemo(() => {
    if (!searchQuery.trim()) return notesArray
    const query = searchQuery.toLowerCase()
    return notesArray.filter(
      (note) =>
        note.mediaTitle.toLowerCase().includes(query) ||
        note.content.toLowerCase().includes(query),
    )
  }, [notesArray, searchQuery])

  // Sort notes based on sort state
  const sortedNotes = useMemo(() => {
    const sorted = [...filteredNotes].sort((a, b) => {
      let comparison = 0

      switch (sortState.field) {
        case "updatedAt": {
          const aTime =
            typeof a.updatedAt?.toMillis === "function"
              ? a.updatedAt.toMillis()
              : 0
          const bTime =
            typeof b.updatedAt?.toMillis === "function"
              ? b.updatedAt.toMillis()
              : 0
          comparison = aTime - bTime
          break
        }
        case "createdAt": {
          const aTime =
            typeof a.createdAt?.toMillis === "function"
              ? a.createdAt.toMillis()
              : 0
          const bTime =
            typeof b.createdAt?.toMillis === "function"
              ? b.createdAt.toMillis()
              : 0
          comparison = aTime - bTime
          break
        }
        case "title": {
          comparison = a.mediaTitle
            .toLowerCase()
            .localeCompare(b.mediaTitle.toLowerCase())
          break
        }
      }

      return sortState.direction === "asc" ? comparison : -comparison
    })

    return sorted
  }, [filteredNotes, sortState])

  // Handle edit - open modal with the note's media
  const handleEdit = useCallback((note: Note) => {
    setEditingNote(note)
    setIsModalOpen(true)
  }, [])

  // Handle delete
  const handleDelete = useCallback(
    async (note: Note) => {
      try {
        await removeNote(note.mediaType, note.mediaId)
        toast.success(`Note for "${note.mediaTitle}" deleted`)
      } catch (error) {
        console.error("Error deleting note:", error)
        toast.error("Failed to delete note")
      }
    },
    [removeNote],
  )

  // Close modal
  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false)
    setEditingNote(null)
  }, [])

  const isLoading = authLoading || notesLoading

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <HugeiconsIcon
          icon={Loading03Icon}
          className="size-8 animate-spin text-primary"
        />
      </div>
    )
  }

  // Not logged in state
  if (!user) {
    return (
      <Empty className="py-20">
        <EmptyMedia variant="icon">
          <HugeiconsIcon icon={Note01Icon} className="size-6" />
        </EmptyMedia>
        <EmptyHeader>
          <EmptyTitle>Sign in to see your notes</EmptyTitle>
          <EmptyDescription>
            Create personal notes for movies and TV shows to track your
            thoughts.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  // No notes state
  if (notesArray.length === 0) {
    return (
      <Empty className="py-20">
        <EmptyMedia variant="icon">
          <HugeiconsIcon icon={Note01Icon} className="size-6" />
        </EmptyMedia>
        <EmptyHeader>
          <EmptyTitle>No notes yet</EmptyTitle>
          <EmptyDescription>
            Add notes to movies and TV shows from their detail pages.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Search and Sort Row */}
      <div className="flex items-center gap-3">
        <SearchInput
          id="notes-search-input"
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search by title or note content..."
          aria-label="Search notes by title or content"
          className="flex-1"
        />
        <FilterSort
          filters={[]}
          filterState={{}}
          onFilterChange={() => {}}
          sortFields={SORT_FIELDS}
          sortState={sortState}
          onSortChange={setSortState}
        />
      </div>

      {/* Results */}
      {sortedNotes.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sortedNotes.map((note) => (
            <NoteCard
              key={`${note.mediaType}-${note.mediaId}`}
              note={note}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : (
        <Empty className="py-20">
          <EmptyMedia variant="icon">
            <HugeiconsIcon icon={Search01Icon} className="size-6" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>No results found</EmptyTitle>
            <EmptyDescription>
              No notes match &quot;{searchQuery}&quot;
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {/* Notes Modal for Editing */}
      {editingNote && (
        <NotesModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          media={{
            id: editingNote.mediaId,
            poster_path: editingNote.posterPath,
            title:
              editingNote.mediaType === "movie"
                ? editingNote.mediaTitle
                : undefined,
            name:
              editingNote.mediaType === "tv"
                ? editingNote.mediaTitle
                : undefined,
          }}
          mediaType={editingNote.mediaType}
        />
      )}
    </div>
  )
}
