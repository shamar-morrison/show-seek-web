"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { useNotes } from "@/hooks/use-notes"
import { NOTE_MAX_LENGTH } from "@/types/note"
import type { TMDBMedia, TMDBMovieDetails, TMDBTVDetails } from "@/types/tmdb"
import { Loading03Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

interface NotesModalProps {
  /** Whether the modal is open */
  isOpen: boolean
  /** Callback when modal should close */
  onClose: () => void
  /** The media item to add notes for */
  media: TMDBMedia | TMDBMovieDetails | TMDBTVDetails
  /** Media type */
  mediaType: "movie" | "tv"
}

/**
 * NotesModal Component
 * Modal for adding/editing personal notes on movies and TV shows
 */
export function NotesModal({
  isOpen,
  onClose,
  media,
  mediaType,
}: NotesModalProps) {
  const { getNote, saveNote, removeNote } = useNotes()
  const [noteContent, setNoteContent] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [hasExistingNote, setHasExistingNote] = useState(false)
  const [originalContent, setOriginalContent] = useState("")

  const title: string =
    "title" in media && media.title
      ? media.title
      : "name" in media && media.name
        ? media.name
        : "Unknown"
  const mediaId = media.id
  const posterPath: string | null =
    "poster_path" in media ? (media.poster_path ?? null) : null

  // Load existing note when modal opens
  useEffect(() => {
    if (isOpen) {
      const existingNote = getNote(mediaType, mediaId)
      const content = existingNote?.content || ""
      setNoteContent(content)
      setOriginalContent(content)
      setHasExistingNote(!!existingNote)
    }
  }, [isOpen, getNote, mediaType, mediaId])

  const handleSave = useCallback(async () => {
    if (noteContent.trim().length === 0) return

    setIsSaving(true)
    try {
      await saveNote(mediaType, mediaId, noteContent.trim(), title, posterPath)
      toast.success("Note saved")
      onClose()
    } catch (error) {
      console.error("Error saving note:", error)
      toast.error("Failed to save note")
    } finally {
      setIsSaving(false)
    }
  }, [noteContent, saveNote, mediaType, mediaId, title, posterPath, onClose])

  const handleClose = useCallback(() => {
    setNoteContent("")
    setOriginalContent("")
    onClose()
  }, [onClose])

  const handleClearNote = useCallback(async () => {
    setIsSaving(true)
    try {
      await removeNote(mediaType, mediaId)
      toast.success("Note cleared")
      onClose()
    } catch (error) {
      console.error("Error clearing note:", error)
      toast.error("Failed to clear note")
    } finally {
      setIsSaving(false)
    }
  }, [removeNote, mediaType, mediaId, onClose])

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
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {hasExistingNote ? "Edit Note" : "Add Note"}
          </DialogTitle>
          <DialogDescription>
            Personal note for &quot;{title}&quot;
          </DialogDescription>
        </DialogHeader>

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

        <div className="flex flex-col gap-3">
          <Button
            size={"lg"}
            onClick={handleSave}
            disabled={isSaving || !canSave}
          >
            {isSaving ? (
              <>
                <HugeiconsIcon
                  icon={Loading03Icon}
                  className="size-4 animate-spin"
                />
                Saving...
              </>
            ) : (
              "Save Note"
            )}
          </Button>
          {hasExistingNote && (
            <Button
              size={"lg"}
              variant="secondary"
              onClick={handleClearNote}
              disabled={isSaving}
            >
              Clear Note
            </Button>
          )}
          <Button
            size={"lg"}
            variant="outline"
            onClick={handleClose}
            disabled={isSaving}
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
