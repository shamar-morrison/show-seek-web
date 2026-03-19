"use client"

import { Button } from "@/components/ui/button"
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
import { Loading03Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useCallback, useId, useState } from "react"
import { toast } from "sonner"

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
      onOpenChange(false)
    }
  }, [isCreating, onOpenChange])

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
            <Label htmlFor={listNameId}>List name</Label>
            <Input
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
            <Label htmlFor={listDescriptionId}>Description (optional)</Label>
            <Textarea
              id={listDescriptionId}
              placeholder="What is this list for?"
              value={listDescription}
              onChange={(e) => setListDescription(e.target.value)}
              maxLength={120}
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
