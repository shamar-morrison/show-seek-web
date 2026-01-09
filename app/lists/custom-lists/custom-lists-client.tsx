"use client"

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
import { useLists } from "@/hooks/use-lists"
import type { Genre } from "@/types/tmdb"
import {
  Delete02Icon,
  Edit02Icon,
  FolderLibraryIcon,
  Loading03Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

interface CustomListsClientProps {
  /** Movie genres for filter options */
  movieGenres?: Genre[]
  /** TV genres for filter options */
  tvGenres?: Genre[]
}

/**
 * Custom Lists Client Component
 * Displays user's custom lists with tab navigation and search filtering
 */
export function CustomListsClient({
  movieGenres = [],
  tvGenres = [],
}: CustomListsClientProps) {
  const { lists, loading, error, removeList, updateList } = useLists()
  const [selectedListId, setSelectedListId] = useState<string>("")

  // Dialog states
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)

  // Filter to only custom lists
  const customLists = useMemo(() => lists.filter((l) => l.isCustom), [lists])

  // Get current active list
  const activeList = useMemo(
    () => customLists.find((l) => l.id === selectedListId),
    [customLists, selectedListId],
  )

  // Update selected list when lists load or active list is deleted
  useEffect(() => {
    if (!loading && customLists.length > 0) {
      if (!selectedListId || !customLists.find((l) => l.id === selectedListId)) {
        setSelectedListId(customLists[0].id)
      }
    }
  }, [loading, customLists, selectedListId])

  // Action Menu Items
  const menuItems: ActionMenuItem[] = useMemo(
    () => [
      {
        type: "action",
        key: "edit",
        label: "Edit List Name",
        icon: Edit02Icon,
        onClick: () => {
          if (activeList) {
            setNewName(activeList.name)
            setIsRenameDialogOpen(true)
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

  const handleRename = useCallback(async () => {
    if (!activeList || !newName.trim()) return

    setIsProcessing(true)
    try {
      await updateList(activeList.id, newName.trim())
      toast.success("List renamed successfully")
      setIsRenameDialogOpen(false)
    } catch (error) {
      console.error("Failed to rename list:", error)
      toast.error("Failed to rename list")
    } finally {
      setIsProcessing(false)
    }
  }, [activeList, newName, updateList])

  const handleDelete = useCallback(async () => {
    if (!activeList) return

    setIsProcessing(true)
    try {
      await removeList(activeList.id)
      toast.success("List deleted successfully")
      setIsDeleteDialogOpen(false)
      // Selection update is handled by the useEffect
    } catch (error) {
      console.error("Failed to delete list:", error)
      toast.error("Failed to delete list")
    } finally {
      setIsProcessing(false)
    }
  }, [activeList, removeList])

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
        selectedListId={selectedListId}
        onListSelect={setSelectedListId}
        showDynamicHeader={true}
        headerAction={
          activeList ? <ActionMenu items={menuItems} align="start" /> : null
        }
      />

      {/* Rename Dialog */}
      <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename List</DialogTitle>
            <DialogDescription>
              Enter a new name for your list.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="List Name"
                disabled={isProcessing}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsRenameDialogOpen(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button onClick={handleRename} disabled={isProcessing || !newName.trim()}>
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
            <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleDelete()
              }}
              disabled={isProcessing}
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
    </>
  )
}
