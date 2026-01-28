"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { buildImageUrl } from "@/lib/tmdb"
import { formatRelativeTime } from "@/lib/utils"
import type { Note } from "@/types/note"
import { Delete02Icon, Edit02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import type { Timestamp } from "firebase/firestore"
import Link from "next/link"
import { useCallback, useState } from "react"

interface NoteCardProps {
  /** The note to display */
  note: Note
  /** Callback when edit is requested */
  onEdit: (note: Note) => void
  /** Callback when delete is confirmed */
  onDelete: (note: Note) => void
}

/**
 * Convert Firestore Timestamp to Date
 */
function timestampToDate(timestamp: Timestamp | Date | number): Date {
  if (timestamp instanceof Date) return timestamp
  if (typeof timestamp === "number") return new Date(timestamp)
  // Firestore Timestamp has toDate() method
  if (typeof timestamp?.toDate === "function") return timestamp.toDate()
  return new Date()
}

/**
 * NoteCard Component
 * Displays a single note with media info, content snippet, and actions
 */
export function NoteCard({ note, onEdit, onDelete }: NoteCardProps) {
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)

  const posterUrl = note.posterPath
    ? buildImageUrl(note.posterPath, "w185")
    : null
  const mediaUrl = `/${note.mediaType}/${note.mediaId}`
  const relativeTime = formatRelativeTime(timestampToDate(note.updatedAt))

  const handleDelete = useCallback(() => {
    onDelete(note)
    setIsDeleteOpen(false)
  }, [note, onDelete])

  return (
    <>
      <div className="group relative flex gap-4 rounded-xl bg-card p-4 transition-colors hover:bg-card/80">
        {/* Media Poster */}
        <Link href={mediaUrl} className="shrink-0">
          <div className="relative aspect-[2/3] w-16 overflow-hidden rounded-lg bg-gray-800 sm:w-20">
            {posterUrl ? (
              <img
                src={posterUrl}
                alt={note.mediaTitle}
                className="absolute inset-0 h-full w-full object-cover"
                sizes="80px"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-gray-500">
                No Image
              </div>
            )}
          </div>
        </Link>

        {/* Content */}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {/* Title */}
          <Link
            href={mediaUrl}
            className="truncate font-medium text-gray-400 hover:text-primary transition-colors"
          >
            {note.mediaTitle}
          </Link>

          {/* Note snippet */}
          <p className="line-clamp-2 text-sm text-white">{note.content}</p>

          {/* Timestamp */}
          <span className="mt-auto text-xs text-gray-500">{relativeTime}</span>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 flex-col gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onEdit(note)}
            className="text-gray-400 hover:text-white"
          >
            <HugeiconsIcon icon={Edit02Icon} className="size-4" />
            <span className="sr-only">Edit note</span>
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setIsDeleteOpen(true)}
            className="text-gray-400 hover:text-destructive"
          >
            <HugeiconsIcon icon={Delete02Icon} className="size-4" />
            <span className="sr-only">Delete note</span>
          </Button>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Note</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete your note for &quot;
              {note.mediaTitle}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
