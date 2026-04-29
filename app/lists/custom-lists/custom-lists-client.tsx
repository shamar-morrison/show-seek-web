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
import { Checkbox } from "@/components/ui/checkbox"
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
import { useBulkListOperations } from "@/hooks/use-bulk-list-operations"
import { useLists } from "@/hooks/use-lists"
import { showActionableSuccessToast } from "@/lib/actionable-toast"
import { restoreList } from "@/lib/firebase/lists"
import type { UserList } from "@/types/list"
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
  const { deleteListsBatch } = useBulkListOperations()
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
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false)
  const [editName, setEditName] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [selectedBulkDeleteIds, setSelectedBulkDeleteIds] = useState<
    Set<string>
  >(new Set())
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  const [bulkDeleteProgress, setBulkDeleteProgress] = useState<{
    processed: number
    total: number
  } | null>(null)
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
          onClick: () => updateList(listId, previousName, previousDescription),
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

  const toggleBulkDeleteSelection = useCallback((listId: string) => {
    setSelectedBulkDeleteIds((prev) => {
      const next = new Set(prev)
      if (next.has(listId)) {
        next.delete(listId)
      } else {
        next.add(listId)
      }
      return next
    })
  }, [])

  const handleOpenBulkDeleteDialog = useCallback(() => {
    setSelectedBulkDeleteIds(new Set())
    setBulkDeleteProgress(null)
    setIsBulkDeleteDialogOpen(true)
  }, [])

  const menuItems = useMemo<ActionMenuItem[]>(
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
        type: "submenu",
        key: "select",
        label: "Select",
        items: [
          {
            type: "action",
            key: "select-items",
            label: "Select Items",
            disabled: !activeList || Object.keys(activeList.items || {}).length === 0,
            onClick: () => {},
          },
          {
            type: "action",
            key: "select-lists",
            label: "Select Lists",
            onClick: handleOpenBulkDeleteDialog,
          },
        ],
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
    [activeList, handleOpenBulkDeleteDialog],
  )

  const handleBulkDelete = useCallback(async () => {
    if (!user || selectedBulkDeleteIds.size === 0) return

    setIsBulkDeleting(true)
    setBulkDeleteProgress({
      processed: 0,
      total: selectedBulkDeleteIds.size,
    })

    try {
      const { deletedIds, failedIds } = await deleteListsBatch({
        listIds: Array.from(selectedBulkDeleteIds),
        onProgress: (processed, total) => {
          setBulkDeleteProgress({ processed, total })
        },
      })

      if (failedIds.length === 0) {
        setIsBulkDeleteDialogOpen(false)
        setSelectedBulkDeleteIds(new Set())
        toast.success(
          `${deletedIds.length} list${deletedIds.length === 1 ? "" : "s"} deleted.`,
        )
        return
      }

      setSelectedBulkDeleteIds(new Set(failedIds))
      toast.error(
        `Failed to delete ${failedIds.length} of ${
          deletedIds.length + failedIds.length
        } selected lists.`,
      )
    } catch (error) {
      console.error("Failed to bulk delete lists:", error)
      toast.error("Failed to delete selected lists.")
    } finally {
      setIsBulkDeleting(false)
      setBulkDeleteProgress(null)
    }
  }, [deleteListsBatch, selectedBulkDeleteIds, user])

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
        showShuffleAction={true}
        showDefaultSelectAction={false}
        filterRowAction={({ canSelectItems, enterSelectionMode }) => {
          const menuItemsWithSelection = menuItems.map((item) => {
            if (item.type !== "submenu" || item.key !== "select") {
              return item
            }

            return {
              ...item,
              items: item.items.map((submenuItem) =>
                submenuItem.type === "action" &&
                submenuItem.key === "select-items"
                  ? {
                      ...submenuItem,
                      disabled: !canSelectItems,
                      onClick: enterSelectionMode,
                    }
                  : submenuItem,
              ),
            }
          })

          return (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => setIsCreateDialogOpen(true)}
                aria-label="Create new list"
                className={"p-4.5"}
              >
                <HugeiconsIcon icon={Add01Icon} className="size-4" />
              </Button>
              {activeList ? (
                <ActionMenu items={menuItemsWithSelection} align="start" />
              ) : null}
            </div>
          )
        }}
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
              disabled={
                isProcessing || !activeList || !user || !editName.trim()
              }
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

      <Dialog
        open={isBulkDeleteDialogOpen}
        onOpenChange={(open) => {
          if (!isBulkDeleting) {
            setIsBulkDeleteDialogOpen(open)
          }
        }}
      >
        <DialogContent className="sm:max-w-lg" showCloseButton={!isBulkDeleting}>
          <DialogHeader>
            <DialogTitle>Select custom lists to delete</DialogTitle>
            <DialogDescription>
              Choose one or more custom lists to delete in bulk. This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {isBulkDeleting ? (
            <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
              {bulkDeleteProgress
                ? `Deleting ${bulkDeleteProgress.processed} of ${bulkDeleteProgress.total} selected lists.`
                : "Deleting selected lists."}
            </div>
          ) : null}

          <div className="max-h-72 space-y-1 overflow-y-auto">
            {customLists.map((list: UserList) => (
              <label
                key={list.id}
                className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-white/5"
              >
                <Checkbox
                  checked={selectedBulkDeleteIds.has(list.id)}
                  onCheckedChange={() => toggleBulkDeleteSelection(list.id)}
                />
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-white">
                    {list.name}
                  </span>
                  {list.description?.trim() ? (
                    <span className="block truncate text-xs text-white/50">
                      {list.description.trim()}
                    </span>
                  ) : null}
                </div>
                <span className="text-xs text-white/40">
                  {Object.keys(list.items || {}).length} items
                </span>
              </label>
            ))}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsBulkDeleteDialogOpen(false)}
              disabled={isBulkDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleBulkDelete()}
              disabled={isBulkDeleting || selectedBulkDeleteIds.size === 0}
            >
              {isBulkDeleting ? (
                <>
                  <HugeiconsIcon
                    icon={Loading03Icon}
                    className="mr-2 size-4 animate-spin"
                  />
                  Deleting...
                </>
              ) : (
                "Delete selected lists"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
