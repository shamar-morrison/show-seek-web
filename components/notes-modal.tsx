"use client"

import { BaseMediaModal } from "@/components/ui/base-media-modal"
import { Button } from "@/components/ui/button"
import { usePreferences } from "@/hooks/use-preferences"
import { Textarea } from "@/components/ui/textarea"
import { showActionableSuccessToast } from "@/lib/actionable-toast"
import { getDisplayMediaTitle } from "@/lib/media-title"
import { useNotes } from "@/hooks/use-notes"
import { NOTE_MAX_LENGTH } from "@/types/note"
import { Loading03Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

/** Minimal media info needed for the notes modal */
interface NotesMediaInfo {
  id: number
  poster_path?: string | null
  title?: string
  name?: string
  original_title?: string
  original_name?: string
  show_id?: number
  season_number?: number
  episode_number?: number
}

interface NotesModalProps {
  /** Whether the modal is open */
  isOpen: boolean
  /** Callback when modal should close */
  onClose: () => void
  /** The media item to add notes for */
  media: NotesMediaInfo
  /** Media type */
  mediaType: "movie" | "tv" | "episode"
}

/**
 * NotesModal Component
 * Modal for adding/editing personal notes on movies, TV shows, and episodes
 */
export function NotesModal({
  isOpen,
  onClose,
  media,
  mediaType,
}: NotesModalProps) {
  const { getNote, saveNote, removeNote } = useNotes()
  const { preferences } = usePreferences()
  const [noteContent, setNoteContent] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [hasExistingNote, setHasExistingNote] = useState(false)
  const [originalContent, setOriginalContent] = useState("")

  const displayTitle =
    getDisplayMediaTitle(media, preferences.showOriginalTitles) || "Unknown"
  const title = media.title || media.name || displayTitle
  const originalTitle = media.original_title || media.original_name || undefined
  const mediaId = media.id
  const posterPath: string | null = media.poster_path ?? null
  const seasonNumber = media.season_number
  const episodeNumber = media.episode_number
  const showId = media.show_id

  // Load existing note when modal opens
  useEffect(() => {
    if (isOpen) {
      const existingNote = getNote(
        mediaType,
        mediaId,
        seasonNumber,
        episodeNumber,
      )
      const content = existingNote?.content || ""
      setNoteContent(content)
      setOriginalContent(content)
      setHasExistingNote(!!existingNote)
    }
  }, [isOpen, getNote, mediaType, mediaId, seasonNumber, episodeNumber])

  const handleSave = useCallback(async () => {
    if (noteContent.trim().length === 0) return

    setIsSaving(true)
    try {
      const nextContent = noteContent.trim()
      if (mediaType === "episode") {
        await saveNote(
          mediaType,
          mediaId,
          nextContent,
          title,
          originalTitle,
          posterPath,
          seasonNumber,
          episodeNumber,
          showId,
        )
      } else {
        await saveNote(
          mediaType,
          mediaId,
          nextContent,
          title,
          originalTitle,
          posterPath,
        )
      }
      showActionableSuccessToast("Note saved", {
        action: {
          label: "Undo",
          onClick: async () => {
            if (hasExistingNote && originalContent.trim().length > 0) {
              if (mediaType === "episode") {
                await saveNote(
                  mediaType,
                  mediaId,
                  originalContent.trim(),
                  title,
                  originalTitle,
                  posterPath,
                  seasonNumber,
                  episodeNumber,
                  showId,
                )
                return
              }

              await saveNote(
                mediaType,
                mediaId,
                originalContent.trim(),
                title,
                originalTitle,
                posterPath,
              )
              return
            }

            if (mediaType === "episode") {
              await removeNote(mediaType, mediaId, seasonNumber, episodeNumber)
              return
            }

            await removeNote(mediaType, mediaId)
          },
          errorMessage: "Failed to undo note changes",
          logMessage: "Failed to undo note save:",
        },
      })
      onClose()
    } catch (error) {
      console.error("Error saving note:", error)
      toast.error("Failed to save note")
    } finally {
      setIsSaving(false)
    }
  }, [
    episodeNumber,
    hasExistingNote,
    mediaId,
    mediaType,
    noteContent,
    onClose,
    originalContent,
    originalTitle,
    posterPath,
    removeNote,
    saveNote,
    seasonNumber,
    showId,
    title,
  ])

  const handleClose = useCallback(() => {
    setNoteContent("")
    setOriginalContent("")
    onClose()
  }, [onClose])

  const handleClearNote = useCallback(async () => {
    setIsSaving(true)
    try {
      const clearedContent = originalContent.trim()
      if (mediaType === "episode") {
        await removeNote(mediaType, mediaId, seasonNumber, episodeNumber)
      } else {
        await removeNote(mediaType, mediaId)
      }
      showActionableSuccessToast("Note cleared", {
        action: {
          label: "Undo",
          onClick: async () => {
            if (mediaType === "episode") {
              await saveNote(
                mediaType,
                mediaId,
                clearedContent,
                title,
                originalTitle,
                posterPath,
                seasonNumber,
                episodeNumber,
                showId,
              )
              return
            }

            await saveNote(
              mediaType,
              mediaId,
              clearedContent,
              title,
              originalTitle,
              posterPath,
            )
          },
          errorMessage: "Failed to restore cleared note",
          logMessage: "Failed to undo note clear:",
        },
      })
      onClose()
    } catch (error) {
      console.error("Error clearing note:", error)
      toast.error("Failed to clear note")
    } finally {
      setIsSaving(false)
    }
  }, [
    episodeNumber,
    mediaId,
    mediaType,
    onClose,
    originalContent,
    originalTitle,
    posterPath,
    removeNote,
    saveNote,
    seasonNumber,
    showId,
    title,
  ])

  const handleContentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value
      if (value.length <= NOTE_MAX_LENGTH) {
        setNoteContent(value)
      }
    },
    [],
  )

  const hasChanges = noteContent.trim() !== originalContent.trim()
  const canSave = noteContent.trim().length > 0 && hasChanges

  return (
    <BaseMediaModal
      isOpen={isOpen}
      onClose={handleClose}
      title={hasExistingNote ? "Edit Note" : "Add Note"}
      description={`Personal note for "${displayTitle}"`}
    >
      {/* Note Input */}
      <div className="py-4">
        <Textarea
          value={noteContent}
          onChange={handleContentChange}
          placeholder="Write your thoughts, opinions, or reminders about this title..."
          className="min-h-[120px] resize-none"
          maxLength={NOTE_MAX_LENGTH}
        />
        <div className="mt-2 text-right text-xs text-gray-500">
          {noteContent.length}/{NOTE_MAX_LENGTH}
        </div>
      </div>

      <div className="flex gap-3">
        {hasExistingNote && (
          <Button
            size={"lg"}
            variant="secondary"
            onClick={handleClearNote}
            disabled={isSaving}
            className="flex-1"
          >
            Clear
          </Button>
        )}
        <Button
          size={"lg"}
          onClick={handleSave}
          disabled={isSaving || !canSave}
          className="flex-1"
        >
          {isSaving ? (
            <>
              <HugeiconsIcon
                icon={Loading03Icon}
                className="mr-2 size-4 animate-spin"
              />
              Saving...
            </>
          ) : (
            "Save"
          )}
        </Button>
      </div>
    </BaseMediaModal>
  )
}
