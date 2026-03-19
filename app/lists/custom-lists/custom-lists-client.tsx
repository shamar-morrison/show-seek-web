"use client"

import { CreateListDialog } from "@/components/create-list-dialog"
import { ListsPageClient } from "@/components/lists-page-client"
import { ActionMenu, ActionMenuItem } from "@/components/ui/action-menu"
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
import { useLists } from "@/hooks/use-lists"
import { showActionableSuccessToast } from "@/lib/actionable-toast"
import { restoreList } from "@/lib/firebase/lists"
import type { Genre } from "@/types/tmdb"
import {
  Add01Icon,
  Delete02Icon,
  Edit02Icon,
  FolderLibraryIcon,
  Loading03Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useCallback, useEffect, useId, useMemo, useState } from "react"
import { toast } from "sonner"

interface CustomListsClientProps {
  /** Movie genres for filter options */
  movieGenres?: Genre[]
  /** TV genres for filter options */
  tvGenres?: Genre[]
  /** Error message if genre fetch failed */
  genreFetchError?: string
  /** Optional list ID parsed from the URL on the server */
  initialListId?: string
}

/**
 * Custom Lists Client Component
 * Displays user's custom lists with tab navigation and search filtering
 */
export function CustomListsClient({
  movieGenres = [],
  tvGenres = [],
  genreFetchError,
  initialListId,
}: CustomListsClientProps) {
  const { user } = useAuth()
  const { lists, loading, error, removeList, updateList } = useLists()
  const [selectedListId, setSelectedListId] = useState<string>("")

  // Show toast if genre fetch failed
  useEffect(() => {
    if (genreFetchError) {
      toast.warning(genreFetchError)
    }
  }, [genreFetchError])

  // Dialog states
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editName, setEditName] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const editListNameId = useId()
  const editListDescriptionId = useId()

  // Filter to only custom lists
  const customLists = useMemo(() => lists.filter((l) => l.isCustom), [lists])
  const urlSelectedListId = initialListId?.trim() || null
  const effectiveSelectedListId = useMemo(() => {
    if (
      urlSelectedListId &&
      customLists.some((list) => list.id === urlSelectedListId)
    ) {
      return urlSelectedListId
    }

    if (
      selectedListId &&
      customLists.some((list) => list.id === selectedListId)
    ) {
      return selectedListId
    }

    return customLists[0]?.id ?? ""
  }, [customLists, selectedListId, urlSelectedListId])

  // Get current active list
  const activeList = useMemo(
    () => customLists.find((l) => l.id === effectiveSelectedListId),
    [customLists, effectiveSelectedListId],
  )

  // Action Menu Items
  const menuItems: ActionMenuItem[] = useMemo(
    () => [
      {
        type: "action",
        key: "edit",
        label: "Edit List Details",
        icon: Edit02Icon,
        onClick: () => {
          if (activeList) {
            setEditName(activeList.name)
            setEditDescription(activeList.description?.trim() || "")
            setIsEditDialogOpen(true)
          }
        },
      },
      {
        type: "separator",
        key: "sep1",
      },
      {
        type: "action",
        key: "delete",
        label: "Delete List",
        icon: Delete02Icon,
        variant: "destructive",
        onClick: () => setIsDeleteDialogOpen(true),
      },
    ],
    [activeList],
  )

  const handleEdit = useCallback(async () => {
    if (!activeList || !user || !editName.trim()) return

    setIsProcessing(true)
    try {
      const listId = activeList.id
      const previousName = activeList.name
      const previousDescription = activeList.description?.trim() || ""
      const nextName = editName.trim()
      const nextDescription = editDescription

      await updateList(listId, nextName, nextDescription)
      showActionableSuccessToast("List details updated successfully", {
        action: {
          label: "Undo",
          onClick: () =>
            updateList(listId, previousName, previousDescription),
          errorMessage: "Failed to undo list edit",
          logMessage: "Failed to undo custom list edit:",
        },
      })
      setIsEditDialogOpen(false)
      setEditName("")
      setEditDescription("")
    } catch (error) {
      console.error("Failed to update list:", error)
      toast.error("Failed to update list")
    } finally {
      setIsProcessing(false)
    }
  }, [activeList, editDescription, editName, updateList, user])

  const handleDelete = useCallback(async () => {
    if (!activeList || !user) return

    setIsProcessing(true)
    try {
      const deletedList = activeList
      await removeList(deletedList.id)
      showActionableSuccessToast("List deleted successfully", {
        action: {
          label: "Undo",
          onClick: async () => {
            await restoreList(user.uid, deletedList)
            setSelectedListId(deletedList.id)
          },
          errorMessage: "Failed to restore deleted list",
          logMessage: "Failed to undo custom list deletion:",
        },
      })
      setIsDeleteDialogOpen(false)
    } catch (error) {
      console.error("Failed to delete list:", error)
      toast.error("Failed to delete list")
    } finally {
      setIsProcessing(false)
    }
  }, [activeList, removeList, user])

  const handleCloseEditDialog = useCallback(() => {
    if (isProcessing) return
    setIsEditDialogOpen(false)
    setEditName("")
    setEditDescription("")
  }, [isProcessing])

  return (
    <>
      <ListsPageClient
        lists={customLists}
        loading={loading}
        error={error}
        defaultIcon={FolderLibraryIcon}
        noListsTitle="No custom lists"
        noListsMessage="Create your first custom list to organize your favorites"
        movieGenres={movieGenres}
        tvGenres={tvGenres}
        selectedListId={effectiveSelectedListId}
        onListSelect={setSelectedListId}
        showDynamicHeader={true}
        headerAction={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setIsCreateDialogOpen(true)}
              aria-label="Create new list"
            >
              <HugeiconsIcon icon={Add01Icon} className="size-4" />
            </Button>
            {activeList && <ActionMenu items={menuItems} align="start" />}
          </div>
        }
        emptyStateAction={
          <Button
            size={"default"}
            onClick={() => setIsCreateDialogOpen(true)}
            className="mt-4"
          >
            <HugeiconsIcon icon={Add01Icon} className="size-4" />
            Create New List
          </Button>
        }
      />

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={handleCloseEditDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit List Details</DialogTitle>
            <DialogDescription>
              Update the name and description for your custom list.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor={editListNameId}>List name</Label>
              <Input
                id={editListNameId}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="List name"
                disabled={isProcessing}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={editListDescriptionId}>
                Description (optional)
              </Label>
              <Textarea
                id={editListDescriptionId}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="What is this list for?"
                maxLength={120}
                rows={4}
                className="min-h-24 resize-none"
                disabled={isProcessing}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCloseEditDialog}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleEdit}
              disabled={isProcessing || !activeList || !user || !editName.trim()}
            >
              {isProcessing && (
                <HugeiconsIcon
                  icon={Loading03Icon}
                  className="mr-2 size-4 animate-spin"
                />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the list &quot;{activeList?.name}
              &quot; and all items in it. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleDelete()
              }}
              disabled={isProcessing || !activeList}
              className="bg-red-600 hover:bg-red-700"
            >
              {isProcessing && (
                <HugeiconsIcon
                  icon={Loading03Icon}
                  className="mr-2 size-4 animate-spin"
                />
              )}
              Delete List
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create List Dialog */}
      <CreateListDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />
    </>
  )
}
