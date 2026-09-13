"use client"

import { Button } from "@/components/ui/button"
import { EmojiPicker, insertEmojiAtCaret } from "@/components/emoji-picker"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/context/auth-context"
import { useListMutations } from "@/hooks/use-list-mutations"
import { showActionableSuccessToast } from "@/lib/actionable-toast"
import {
  PREMIUM_LOADING_MESSAGE,
  isPremiumStatusPending,
  shouldEnforcePremiumLock,
} from "@/lib/premium-gating"
import {
  createPremiumTelemetryPayload,
  trackPremiumEvent,
} from "@/lib/premium-telemetry"
import { Loading03Icon, SmileIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useCallback, useId, useRef, useState } from "react"
import { toast } from "sonner"

/** Maximum character limit for the list description */
const LIST_DESCRIPTION_MAX_LENGTH = 120

interface EmojiInsertButtonProps {
  /** Accessible label for the trigger button */
  label: string
  /** Whether the dialog is busy (disables the trigger and grid) */
  disabled?: boolean
  /** Called with the selected emoji character(s) */
  onSelect: (emoji: string) => void
  /** Controlled open state for the popover */
  open: boolean
  /** Callback when the popover open state changes */
  onOpenChange: (open: boolean) => void
}

/**
 * EmojiInsertButton Component
 * Smile-icon trigger that opens the shared emoji grid in a popover.
 */
function EmojiInsertButton({
  label,
  disabled,
  onSelect,
  open,
  onOpenChange,
}: EmojiInsertButtonProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            disabled={disabled}
            aria-label={label}
            title="Add emoji (Win + . / Cmd + Ctrl + Space)"
          />
        }
      >
        <HugeiconsIcon icon={SmileIcon} className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent side="top" align="end" className="z-[60] w-[300px] p-3">
        <EmojiPicker onSelect={onSelect} disabled={disabled} />
      </PopoverContent>
    </Popover>
  )
}

interface CreateListDialogProps {
  /** Whether the dialog is open */
  open: boolean
  /** Callback when dialog open state changes */
  onOpenChange: (open: boolean) => void
}

/**
 * Standalone Create List Dialog Component
 * Creates a new custom list for the authenticated user
 */
export function CreateListDialog({
  open,
  onOpenChange,
}: CreateListDialogProps) {
  const { user, premiumLoading, premiumStatus } = useAuth()
  const { createList, deleteList } = useListMutations()
  const [listName, setListName] = useState("")
  const [listDescription, setListDescription] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [isNamePickerOpen, setIsNamePickerOpen] = useState(false)
  const [isDescriptionPickerOpen, setIsDescriptionPickerOpen] = useState(false)
  const listNameRef = useRef<HTMLInputElement>(null)
  const listDescriptionRef = useRef<HTMLTextAreaElement>(null)
  const listNameId = useId()
  const listDescriptionId = useId()
  const isPremiumCheckPending = isPremiumStatusPending({
    premiumLoading,
    premiumStatus,
  })
  const shouldRunFreeUserLimitCheck = shouldEnforcePremiumLock({
    premiumLoading,
    premiumStatus,
  })

  const handleCreate = useCallback(async () => {
    if (!user || !listName.trim()) return

    if (isPremiumCheckPending) {
      trackPremiumEvent(
        "premium_gate_blocked_while_loading",
        createPremiumTelemetryPayload({
          uid: user.uid,
          premiumStatusBefore: premiumStatus,
          premiumStatusAfter: premiumStatus,
        }),
      )
      toast.info(`${PREMIUM_LOADING_MESSAGE} Please try again in a moment.`)
      return
    }

    setIsCreating(true)

    try {
      // Check server-side if the user can create more lists (only for free users)
      if (shouldRunFreeUserLimitCheck) {
        const response = await fetch("/api/lists/can-create")
        if (!response.ok) {
          throw new Error("Failed to check list limit")
        }
        const { canCreate, limit } = (await response.json()) as {
          canCreate?: boolean
          limit?: number | null
        }
        if (!canCreate) {
          const limitDisplay =
            typeof limit === "number" ? String(limit) : "your limit"
          toast.error(
            `You've reached the limit of ${limitDisplay} custom lists. Upgrade to Premium for unlimited lists!`,
            {
              action: {
                label: "Upgrade",
                onClick: () => {
                  window.open("/profile", "_blank")
                },
              },
            },
          )
          setIsCreating(false)
          return
        }
      }

      // Create the list
      const createdListName = listName.trim()
      const createdListDescription = listDescription.trim()
      const listId = await createList(
        createdListName,
        createdListDescription || undefined,
      )

      showActionableSuccessToast(`Created "${createdListName}"`, {
        action: {
          label: "Undo",
          onClick: () => deleteList(listId),
          errorMessage: "Failed to undo list creation",
          logMessage: "Failed to undo list creation:",
        },
      })
      setListName("")
      setListDescription("")
      onOpenChange(false)
    } catch (error) {
      console.error("Error creating list:", error)
      toast.error("Failed to create list. Please try again.")
    } finally {
      setIsCreating(false)
    }
  }, [
    createList,
    deleteList,
    isPremiumCheckPending,
    listName,
    listDescription,
    onOpenChange,
    premiumStatus,
    shouldRunFreeUserLimitCheck,
    user,
  ])

  const handleClose = useCallback(() => {
    if (!isCreating) {
      setListName("")
      setListDescription("")
      setIsNamePickerOpen(false)
      setIsDescriptionPickerOpen(false)
      onOpenChange(false)
    }
  }, [isCreating, onOpenChange])

  const focusAfterInsert = useCallback(
    (
      element: HTMLInputElement | HTMLTextAreaElement | null,
      caret: number,
    ) => {
      requestAnimationFrame(() => {
        element?.focus()
        element?.setSelectionRange(caret, caret)
      })
    },
    [],
  )

  const handleNameEmojiSelect = useCallback(
    (emoji: string) => {
      const element = listNameRef.current
      const next = insertEmojiAtCaret(
        listName,
        emoji,
        element?.selectionStart ?? null,
        element?.selectionEnd ?? null,
      )
      if (next === null) {
        return
      }
      setListName(next)
      // Popover stays open for multi-insert; restore caret after the emoji.
      focusAfterInsert(element, (element?.selectionStart ?? 0) + emoji.length)
    },
    [focusAfterInsert, listName],
  )

  const handleDescriptionEmojiSelect = useCallback(
    (emoji: string) => {
      const element = listDescriptionRef.current
      const next = insertEmojiAtCaret(
        listDescription,
        emoji,
        element?.selectionStart ?? null,
        element?.selectionEnd ?? null,
        LIST_DESCRIPTION_MAX_LENGTH,
      )
      // Silently cap at the limit, consistent with maxLength on the textarea.
      if (next === null) {
        return
      }
      setListDescription(next)
      focusAfterInsert(element, (element?.selectionStart ?? 0) + emoji.length)
    },
    [focusAfterInsert, listDescription],
  )

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Custom List</DialogTitle>
          <DialogDescription>
            Enter a name and optional description for your new list
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor={listNameId}>List name</Label>
              <EmojiInsertButton
                label="Add emoji to list name"
                disabled={isCreating}
                onSelect={handleNameEmojiSelect}
                open={isNamePickerOpen}
                onOpenChange={setIsNamePickerOpen}
              />
            </div>
            <Input
              ref={listNameRef}
              id={listNameId}
              placeholder="List name"
              value={listName}
              onChange={(e) => setListName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && listName.trim()) {
                  handleCreate()
                }
              }}
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor={listDescriptionId}>Description (optional)</Label>
              <EmojiInsertButton
                label="Add emoji to description"
                disabled={isCreating}
                onSelect={handleDescriptionEmojiSelect}
                open={isDescriptionPickerOpen}
                onOpenChange={setIsDescriptionPickerOpen}
              />
            </div>
            <Textarea
              ref={listDescriptionRef}
              id={listDescriptionId}
              placeholder="What is this list for?"
              value={listDescription}
              onChange={(e) => setListDescription(e.target.value)}
              maxLength={LIST_DESCRIPTION_MAX_LENGTH}
              rows={4}
              className="min-h-24 resize-none"
            />
          </div>
        </div>
        {isPremiumCheckPending && (
          <p className="text-xs text-muted-foreground">
            {PREMIUM_LOADING_MESSAGE}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isCreating}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!listName.trim() || isCreating || isPremiumCheckPending}
          >
            {isCreating ? (
              <>
                <HugeiconsIcon
                  icon={Loading03Icon}
                  className="mr-2 size-4 animate-spin"
                />
                Creating...
              </>
            ) : (
              "Create"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
