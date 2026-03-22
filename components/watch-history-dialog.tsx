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
import { Calendar } from "@/components/ui/calendar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { WatchInstance } from "@/lib/firebase/watched-movies"
import {
  Calendar03Icon,
  Delete02Icon,
  Edit02Icon,
  Loading03Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useEffect, useMemo, useState } from "react"

interface WatchHistoryDialogProps {
  isOpen: boolean
  onClose: () => void
  movieTitle: string
  instances: WatchInstance[]
  isLoading?: boolean
  onDeleteWatch: (watchId: string) => Promise<void>
  onUpdateWatch: (watchId: string, watchedAt: Date) => Promise<void>
}

function getOrdinalSuffix(value: number): string {
  const suffixes = ["th", "st", "nd", "rd"]
  const remainder = value % 100
  return `${value}${suffixes[(remainder - 20) % 10] || suffixes[remainder] || suffixes[0]}`
}

function formatWatchDate(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date)
}

export function WatchHistoryDialog({
  isOpen,
  onClose,
  movieTitle,
  instances,
  isLoading = false,
  onDeleteWatch,
  onUpdateWatch,
}: WatchHistoryDialogProps) {
  const [watchToDelete, setWatchToDelete] = useState<WatchInstance | null>(null)
  const [watchToEdit, setWatchToEdit] = useState<WatchInstance | null>(null)
  const [selectedEditDate, setSelectedEditDate] = useState<Date | undefined>(
    undefined,
  )
  const [isSubmittingDelete, setIsSubmittingDelete] = useState(false)
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false)

  const sortedInstances = useMemo(
    () =>
      [...instances].sort(
        (left, right) => right.watchedAt.getTime() - left.watchedAt.getTime(),
      ),
    [instances],
  )

  useEffect(() => {
    if (!isOpen || isLoading || sortedInstances.length > 0) {
      return
    }

    onClose()
  }, [isLoading, isOpen, onClose, sortedInstances.length])

  useEffect(() => {
    if (isOpen) {
      return
    }

    setWatchToDelete(null)
    setWatchToEdit(null)
    setSelectedEditDate(undefined)
    setIsSubmittingDelete(false)
    setIsSubmittingEdit(false)
  }, [isOpen])

  const handleDeleteConfirm = async () => {
    if (!watchToDelete) {
      return
    }

    setIsSubmittingDelete(true)
    try {
      await onDeleteWatch(watchToDelete.id)
      setWatchToDelete(null)
    } catch (error) {
      console.error("Error deleting watch history entry:", error)
    } finally {
      setIsSubmittingDelete(false)
    }
  }

  const handleEditOpen = (watch: WatchInstance) => {
    setWatchToEdit(watch)
    setSelectedEditDate(new Date(watch.watchedAt))
  }

  const handleEditSave = async () => {
    if (!watchToEdit || !selectedEditDate) {
      return
    }

    setIsSubmittingEdit(true)
    try {
      await onUpdateWatch(watchToEdit.id, selectedEditDate)
      setWatchToEdit(null)
      setSelectedEditDate(undefined)
    } catch (error) {
      console.error("Error updating watch history entry:", error)
    } finally {
      setIsSubmittingEdit(false)
    }
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Watch history</DialogTitle>
            <DialogDescription>{movieTitle}</DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <HugeiconsIcon
                icon={Loading03Icon}
                className="size-4 animate-spin"
              />
              Loading watch history...
            </div>
          ) : sortedInstances.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No watch history yet.
            </div>
          ) : (
            <ScrollArea className="max-h-[24rem] pr-3" viewportClassName="pr-3">
              <div className="flex flex-col gap-3">
                {sortedInstances.map((watch, index) => {
                  const watchNumber = sortedInstances.length - index
                  const ordinalLabel = `${getOrdinalSuffix(watchNumber)} watch`

                  return (
                    <div
                      key={watch.id}
                      className="flex items-start justify-between gap-3 rounded-lg border border-white/10 bg-white/5 p-4"
                    >
                      <div className="min-w-0 space-y-1">
                        <p className="font-medium text-white">{ordinalLabel}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatWatchDate(watch.watchedAt)}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          onClick={() => handleEditOpen(watch)}
                          aria-label={`Edit ${ordinalLabel}`}
                        >
                          <HugeiconsIcon icon={Edit02Icon} className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon-sm"
                          onClick={() => setWatchToDelete(watch)}
                          aria-label={`Delete ${ordinalLabel}`}
                        >
                          <HugeiconsIcon
                            icon={Delete02Icon}
                            className="size-4"
                          />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!watchToEdit}
        onOpenChange={(open) => {
          if (open) {
            return
          }

          setWatchToEdit(null)
          setSelectedEditDate(undefined)
        }}
      >
        <DialogContent className="sm:max-w-fit">
          <DialogHeader>
            <DialogTitle>Edit watched date</DialogTitle>
            <DialogDescription>{movieTitle}</DialogDescription>
          </DialogHeader>

          <Calendar
            mode="single"
            selected={selectedEditDate}
            onSelect={setSelectedEditDate}
            disabled={(date) => date > new Date()}
            captionLayout="dropdown"
            fromYear={1900}
            toYear={new Date().getFullYear()}
          />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setWatchToEdit(null)
                setSelectedEditDate(undefined)
              }}
              disabled={isSubmittingEdit}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleEditSave}
              disabled={!selectedEditDate || isSubmittingEdit}
            >
              {isSubmittingEdit ? (
                <>
                  <HugeiconsIcon
                    icon={Loading03Icon}
                    className="size-4 animate-spin"
                  />
                  Saving...
                </>
              ) : (
                <>
                  <HugeiconsIcon icon={Calendar03Icon} className="size-4" />
                  Save date
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!watchToDelete}
        onOpenChange={(open) => {
          if (!open) {
            setWatchToDelete(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete watch entry?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove this recorded watch from the movie&apos;s history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmittingDelete}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isSubmittingDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              {isSubmittingDelete ? (
                <>
                  <HugeiconsIcon
                    icon={Loading03Icon}
                    className="size-4 animate-spin"
                  />
                  Deleting...
                </>
              ) : (
                "Delete watch"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
