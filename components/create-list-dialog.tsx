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
import { useAuth } from "@/context/auth-context"
import { useListMutations } from "@/hooks/use-list-mutations"
import { Loading03Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useCallback, useState } from "react"
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
  const { user, isPremium } = useAuth()
  const { createList } = useListMutations()
  const [listName, setListName] = useState("")
  const [isCreating, setIsCreating] = useState(false)

  const handleCreate = useCallback(async () => {
    if (!user || !listName.trim()) return

    setIsCreating(true)

    try {
      // Check server-side if the user can create more lists (only for free users)
      if (!isPremium) {
        const response = await fetch("/api/lists/can-create")
        if (!response.ok) {
          throw new Error("Failed to check list limit")
        }
        const { canCreate, limit } = await response.json()
        if (!canCreate) {
          toast.error(
            `You've reached the limit of ${limit} custom lists. Upgrade to Premium for unlimited lists!`,
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
      await createList(listName.trim())

      toast.success(`Created "${listName.trim()}"`)
      setListName("")
      onOpenChange(false)
    } catch (error) {
      console.error("Error creating list:", error)
      toast.error("Failed to create list. Please try again.")
    } finally {
      setIsCreating(false)
    }
  }, [user, isPremium, listName, createList, onOpenChange])

  const handleClose = useCallback(() => {
    if (!isCreating) {
      setListName("")
      onOpenChange(false)
    }
  }, [isCreating, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Create Custom List</DialogTitle>
          <DialogDescription>Enter a name for your new list</DialogDescription>
        </DialogHeader>
        <Input
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
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isCreating}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!listName.trim() || isCreating}
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
