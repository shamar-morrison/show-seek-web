"use client"

import { BaseMediaModal } from "@/components/ui/base-media-modal"
import { Button } from "@/components/ui/button"
import { NotesEmojiPicker } from "@/components/notes-emoji-picker"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { PremiumModal } from "@/components/premium-modal"
import { useAuth } from "@/context/auth-context"
import { usePreferences } from "@/hooks/use-preferences"
import { Textarea } from "@/components/ui/textarea"
import { showActionableSuccessToast } from "@/lib/actionable-toast"
import { getDisplayMediaTitle } from "@/lib/media-title"
import { MAX_FREE_NOTES } from "@/lib/notes-limits"
import { useNotes } from "@/hooks/use-notes"
import { NOTE_MAX_LENGTH } from "@/types/note"
import { Loading03Icon, SmileIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useCallback, useEffect, useRef, useState } from "react"
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
  mediaType: "movie" | "tv" | "episode" | "season"
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
  const { premiumStatus } = useAuth()
  const [noteContent, setNoteContent] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [hasExistingNote, setHasExistingNote] = useState(false)
  const [originalContent, setOriginalContent] = useState("")
  const [limitCheck, setLimitCheck] = useState<
    "idle" | "checking" | "allowed" | "blocked"
  >("idle")
  const [showPremiumModal, setShowPremiumModal] = useState(false)
  const [noteLimit, setNoteLimit] = useState(MAX_FREE_NOTES)
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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

  // Freemium gate (mobile parity): editing an existing note never counts
  // against the limit and premium users skip the check entirely. New notes
  // are verified server-side so the count can't go stale.
  const existingNote = getNote(mediaType, mediaId, seasonNumber, episodeNumber)
  useEffect(() => {
    if (!isOpen) {
      setLimitCheck("idle")
      return
    }
    if (existingNote || premiumStatus === "premium") {
      setLimitCheck("allowed")
      return
    }

    let cancelled = false
    setLimitCheck("checking")
    fetch("/api/notes/can-create")
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Failed to check note limit")
        }
        return (await response.json()) as {
          canCreate?: boolean
          limit?: number | null
        }
      })
      .then(({ canCreate, limit }) => {
        if (cancelled) return
        if (typeof limit === "number") {
          setNoteLimit(limit)
        }
        if (canCreate) {
          setLimitCheck("allowed")
        } else {
          setLimitCheck("blocked")
          onClose()
          setShowPremiumModal(true)
        }
      })
      .catch((error) => {
        if (cancelled) return
        console.error("Error checking note limit:", error)
        toast.error("Failed to check note limit")
        onClose()
      })
    return () => {
      cancelled = true
    }
  }, [isOpen, existingNote, premiumStatus, onClose])

  const handleSave = useCallback(async () => {
    if (noteContent.trim().length === 0) return

    setIsSaving(true)
    try {
      const nextContent = noteContent.trim()
      if (mediaType === "episode" || mediaType === "season") {
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
              if (mediaType === "episode" || mediaType === "season") {
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

            if (mediaType === "episode" || mediaType === "season") {
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
    setIsEmojiPickerOpen(false)
    onClose()
  }, [onClose])

  const handleClearNote = useCallback(async () => {
    setIsSaving(true)
    try {
      const clearedContent = originalContent.trim()
      if (mediaType === "episode" || mediaType === "season") {
        await removeNote(mediaType, mediaId, seasonNumber, episodeNumber)
      } else {
        await removeNote(mediaType, mediaId)
      }
      showActionableSuccessToast("Note cleared", {
        action: {
          label: "Undo",
          onClick: async () => {
            if (mediaType === "episode" || mediaType === "season") {
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

  const handleEmojiSelect = useCallback(
    (emoji: string) => {
      const textarea = textareaRef.current
      const start = textarea?.selectionStart ?? noteContent.length
      const end = textarea?.selectionEnd ?? start
      const nextContent =
        noteContent.slice(0, start) + emoji + noteContent.slice(end)
      // Silently cap at the limit, consistent with handleContentChange.
      // Note: most emoji count as 2 UTF-16 units toward NOTE_MAX_LENGTH.
      if (nextContent.length > NOTE_MAX_LENGTH) {
        return
      }
      setNoteContent(nextContent)
      // Restore focus and caret after the inserted emoji (popover stays open
      // for multi-insert).
      requestAnimationFrame(() => {
        textarea?.focus()
        const caret = start + emoji.length
        textarea?.setSelectionRange(caret, caret)
      })
    },
    [noteContent],
  )

  const hasChanges = noteContent.trim() !== originalContent.trim()
  const canSave = noteContent.trim().length > 0 && hasChanges

  return (
    <>
      <BaseMediaModal
        isOpen={isOpen}
        onClose={handleClose}
        title={hasExistingNote ? "Edit Note" : "Add Note"}
        description={`Personal note for "${displayTitle}"`}
      >
        {/* Note Input */}
        <div className="py-4">
          <Textarea
            ref={textareaRef}
            value={noteContent}
            onChange={handleContentChange}
            placeholder="Write your thoughts, opinions, or reminders about this title..."
            className="min-h-[120px] resize-none"
            maxLength={NOTE_MAX_LENGTH}
          />
          <div className="mt-2 flex items-center justify-between">
            <Popover
              open={isEmojiPickerOpen}
              onOpenChange={setIsEmojiPickerOpen}
            >
              <PopoverTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={isSaving}
                    aria-label="Add emoji"
                    title="Add emoji (Win + . / Cmd + Ctrl + Space)"
                  />
                }
              >
                <HugeiconsIcon icon={SmileIcon} className="size-4" />
              </PopoverTrigger>
              <PopoverContent
                side="top"
                align="start"
                className="z-[60] w-[300px] p-3"
              >
                <NotesEmojiPicker
                  onSelect={handleEmojiSelect}
                  disabled={isSaving}
                />
              </PopoverContent>
            </Popover>
            <div className="text-xs text-gray-500">
              {noteContent.length}/{NOTE_MAX_LENGTH}
            </div>
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
            disabled={isSaving || !canSave || limitCheck === "checking"}
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
      {showPremiumModal && (
        <PremiumModal
          open={showPremiumModal}
          onOpenChange={setShowPremiumModal}
          title="Note Limit Reached"
          description={`You've reached the limit of ${noteLimit} notes. Upgrade to Premium for unlimited notes!`}
        />
      )}
    </>
  )
}
