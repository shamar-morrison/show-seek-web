"use client"

import { NoteCard } from "@/components/note-card"
import { NotesModal } from "@/components/notes-modal"
import { FilterTabButton } from "@/components/ui/filter-tab-button"
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
import { showActionableSuccessToast } from "@/lib/actionable-toast"
import { getEpisodeNoteMetadata } from "@/lib/note-utils"
import { usePreferences } from "@/hooks/use-preferences"
import { getDisplayNormalizedTitle } from "@/lib/media-title"
import type { Note } from "@/types/note"
import {
  Film01Icon,
  Loading03Icon,
  Note01Icon,
  PlayCircle02Icon,
  Search01Icon,
  Tv01Icon,
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

type NoteTab = "all" | Note["mediaType"]

/**
 * NotesClient Component
 * Client component for the notes page with search, sort, grid, and modals
 */
export function NotesClient() {
  const { user, loading: authLoading } = useAuth()
  const { preferences } = usePreferences()
  const { notes, loading: notesLoading, removeNote, saveNote } = useNotes()
  const [searchQuery, setSearchQuery] = useState("")
  const [editingNote, setEditingNote] = useState<Note | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<NoteTab>("all")

  // Sort state
  const [sortState, setSortState] = useState<SortState>({
    field: "updatedAt",
    direction: "desc",
  })

  // Convert notes Map to array
  const notesArray = useMemo(() => Array.from(notes.values()), [notes])
  const hasActiveSearch = searchQuery.trim().length > 0

  const noteCounts = useMemo(
    () =>
      notesArray.reduce(
        (counts, note) => {
          counts[note.mediaType] += 1
          counts.all += 1
          return counts
        },
        { all: 0, movie: 0, tv: 0, episode: 0 },
      ),
    [notesArray],
  )

  // Filter notes by media title, original title, or note content
  const searchedNotes = useMemo(() => {
    if (!hasActiveSearch) return notesArray
    const query = searchQuery.toLowerCase()
    return notesArray.filter(
      (note) =>
        note.mediaTitle.toLowerCase().includes(query) ||
        (note.originalTitle || "").toLowerCase().includes(query) ||
        note.content.toLowerCase().includes(query),
    )
  }, [hasActiveSearch, notesArray, searchQuery])

  const filteredNotes = useMemo(() => {
    if (activeTab === "all") {
      return searchedNotes
    }

    return searchedNotes.filter((note) => note.mediaType === activeTab)
  }, [activeTab, searchedNotes])

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
          const titleA = getDisplayNormalizedTitle(
            {
              title: a.mediaTitle,
              originalTitle: a.originalTitle,
            },
            preferences.showOriginalTitles,
          ).toLowerCase()
          const titleB = getDisplayNormalizedTitle(
            {
              title: b.mediaTitle,
              originalTitle: b.originalTitle,
            },
            preferences.showOriginalTitles,
          ).toLowerCase()
          comparison = titleA.localeCompare(titleB)
          break
        }
      }

      return sortState.direction === "asc" ? comparison : -comparison
    })

    return sorted
  }, [filteredNotes, preferences.showOriginalTitles, sortState])

  // Handle edit - open modal with the note's media
  const handleEdit = useCallback((note: Note) => {
    setEditingNote(note)
    setIsModalOpen(true)
  }, [])

  // Handle delete
  const handleDelete = useCallback(
    async (note: Note) => {
      try {
        if (note.mediaType === "episode") {
          const episode = getEpisodeNoteMetadata(note)

          await removeNote(
            note.mediaType,
            note.mediaId,
            episode?.seasonNumber,
            episode?.episodeNumber,
          )
        } else {
          await removeNote(note.mediaType, note.mediaId)
        }

        showActionableSuccessToast(
          `Note for "${getDisplayNormalizedTitle(
            {
              title: note.mediaTitle,
              originalTitle: note.originalTitle,
            },
            preferences.showOriginalTitles,
          )}" deleted`,
          {
            action: {
              label: "Undo",
              onClick: async () => {
                if (note.mediaType === "episode") {
                  const episode = getEpisodeNoteMetadata(note)

                  await saveNote(
                    note.mediaType,
                    note.mediaId,
                    note.content,
                    note.mediaTitle,
                    note.originalTitle,
                    note.posterPath,
                    episode?.seasonNumber,
                    episode?.episodeNumber,
                    note.showId,
                  )
                  return
                }

                await saveNote(
                  note.mediaType,
                  note.mediaId,
                  note.content,
                  note.mediaTitle,
                  note.originalTitle,
                  note.posterPath,
                )
              },
              errorMessage: "Failed to restore deleted note",
              logMessage: "Failed to undo note deletion:",
            },
          },
        )
      } catch (error) {
        console.error("Error deleting note:", error)
        toast.error("Failed to delete note")
      }
    },
    [preferences.showOriginalTitles, removeNote, saveNote],
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
            Create personal notes for movies, TV shows, and episodes to track
            your thoughts.
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
            Add notes to movies, TV shows, and episodes from their detail
            pages.
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
          placeholder="Search by media title, original title, or note content..."
          aria-label="Search notes by media title, original title, or content"
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

      <div className="flex flex-wrap items-center gap-3">
        <FilterTabButton
          label="All"
          count={noteCounts.all}
          isActive={activeTab === "all"}
          icon={Note01Icon}
          onClick={() => setActiveTab("all")}
        />
        <FilterTabButton
          label="Movies"
          count={noteCounts.movie}
          isActive={activeTab === "movie"}
          icon={Film01Icon}
          onClick={() => setActiveTab("movie")}
        />
        <FilterTabButton
          label="TV Shows"
          count={noteCounts.tv}
          isActive={activeTab === "tv"}
          icon={Tv01Icon}
          onClick={() => setActiveTab("tv")}
        />
        <FilterTabButton
          label="Episodes"
          count={noteCounts.episode}
          isActive={activeTab === "episode"}
          icon={PlayCircle02Icon}
          onClick={() => setActiveTab("episode")}
        />
      </div>

      {/* Results */}
      {sortedNotes.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sortedNotes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : hasActiveSearch ? (
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
      ) : (
        <Empty className="py-20">
          <EmptyMedia variant="icon">
            <HugeiconsIcon
              icon={
                activeTab === "movie"
                  ? Film01Icon
                  : activeTab === "tv"
                    ? Tv01Icon
                    : activeTab === "episode"
                      ? PlayCircle02Icon
                      : Note01Icon
              }
              className="size-6"
            />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>
              {activeTab === "movie"
                ? "No movie notes yet"
                : activeTab === "tv"
                  ? "No TV show notes yet"
                  : "No episode notes yet"}
            </EmptyTitle>
            <EmptyDescription>
              {activeTab === "movie"
                ? "Add notes to movie detail pages to see them here."
                : activeTab === "tv"
                  ? "Add notes to TV show detail pages to see them here."
                  : "Add notes to episode detail pages to see them here."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {/* Notes Modal for Editing */}
      {editingNote &&
        (() => {
          const episode = getEpisodeNoteMetadata(editingNote)

          return (
            <NotesModal
              isOpen={isModalOpen}
              onClose={handleCloseModal}
              media={{
                id:
                  editingNote.mediaType === "episode"
                    ? episode?.tvShowId ?? editingNote.mediaId
                    : editingNote.mediaId,
                poster_path: editingNote.posterPath,
                title:
                  editingNote.mediaType === "movie" ||
                  editingNote.mediaType === "episode"
                    ? editingNote.mediaTitle
                    : undefined,
                original_title:
                  editingNote.mediaType === "movie" ||
                  editingNote.mediaType === "episode"
                    ? editingNote.originalTitle
                    : undefined,
                name:
                  editingNote.mediaType === "tv"
                    ? editingNote.mediaTitle
                    : undefined,
                original_name:
                  editingNote.mediaType === "tv"
                    ? editingNote.originalTitle
                    : undefined,
                show_id:
                  editingNote.mediaType === "episode"
                    ? episode?.tvShowId ?? editingNote.showId ?? editingNote.mediaId
                    : undefined,
                season_number:
                  editingNote.mediaType === "episode"
                    ? episode?.seasonNumber
                    : undefined,
                episode_number:
                  editingNote.mediaType === "episode"
                    ? episode?.episodeNumber
                    : undefined,
              }}
              mediaType={editingNote.mediaType}
            />
          )
        })()}
    </div>
  )
}
