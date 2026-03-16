"use client"

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
import { useAuth } from "@/context/auth-context"
import { useListMutations } from "@/hooks/use-list-mutations"
import { useLists } from "@/hooks/use-lists"
import { usePreferences } from "@/hooks/use-preferences"
import { showActionableSuccessToast } from "@/lib/actionable-toast"
import { fetchUserList, restoreList } from "@/lib/firebase/lists"
import { getDisplayMediaTitle } from "@/lib/media-title"
import {
  PREMIUM_LOADING_MESSAGE,
  isPremiumStatusPending,
  shouldEnforcePremiumLock,
} from "@/lib/premium-gating"
import {
  createPremiumTelemetryPayload,
  trackPremiumEvent,
} from "@/lib/premium-telemetry"
import type { ListMediaItem, UserList } from "@/types/list"
import type { TMDBMedia, TMDBMovieDetails, TMDBTVDetails } from "@/types/tmdb"
import {
  Add01Icon,
  Bookmark02Icon,
  Cancel01Icon,
  Delete02Icon,
  FavouriteIcon,
  FolderLibraryIcon,
  Loading03Icon,
  PencilEdit01Icon,
  PlayCircle02Icon,
  Settings02Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

/** Map list IDs to icons for default lists */
const LIST_ICONS: Record<string, typeof Bookmark02Icon> = {
  watchlist: Bookmark02Icon,
  "currently-watching": PlayCircle02Icon,
  "already-watched": Tick02Icon,
  favorites: FavouriteIcon,
  dropped: Cancel01Icon,
}

type TabType = "default" | "custom"
type ModalMode = "add" | "manage"
type PreparedListOperation =
  | {
      type: "add"
      listId: string
      listName: string
      mediaItem: Omit<ListMediaItem, "addedAt">
      rollbackMediaId: string
    }
  | {
      type: "remove"
      listId: string
      listName: string
      mediaId: string
      rollbackMediaItem: Omit<ListMediaItem, "addedAt">
    }

interface AddToListModalProps {
  /** Whether the modal is open */
  isOpen: boolean
  /** Callback when modal should close */
  onClose: () => void
  /** The media item to add to lists */
  media: TMDBMedia | TMDBMovieDetails | TMDBTVDetails
  /** Media type */
  mediaType: "movie" | "tv"
}

function stripAddedAt({
  addedAt,
  ...mediaItem
}: ListMediaItem): Omit<ListMediaItem, "addedAt"> {
  void addedAt
  return mediaItem
}

function getStoredListItemEntry(
  list: UserList,
  mediaId: number,
  mediaKey: string,
) {
  const numericKey = String(mediaId)
  const numericItem = list.items?.[numericKey]

  if (numericItem) {
    return {
      item: numericItem,
      itemKey: numericKey,
    }
  }

  const prefixedItem = list.items?.[mediaKey]

  if (prefixedItem) {
    return {
      item: prefixedItem,
      itemKey: mediaKey,
    }
  }

  return null
}

function formatListNames(listNames: string[]) {
  if (listNames.length === 0) {
    return ""
  }

  if (listNames.length === 1) {
    return `"${listNames[0]}"`
  }

  if (listNames.length === 2) {
    return `"${listNames[0]}" and "${listNames[1]}"`
  }

  return `${listNames
    .slice(0, -1)
    .map((name) => `"${name}"`)
    .join(", ")}, and "${listNames.at(-1)}"`
}

/**
 * AddToListModal Component
 * Modal for adding/removing media items from default and custom lists
 * Also supports creating, renaming, and deleting custom lists
 */
export function AddToListModal({
  isOpen,
  onClose,
  media,
  mediaType,
}: AddToListModalProps) {
  const { user, premiumLoading, premiumStatus } = useAuth()
  const { lists, loading: listsLoading } = useLists()
  const { preferences } = usePreferences()
  const { addToList, removeFromList, createList, renameList, deleteList } =
    useListMutations()
  const [activeTab, setActiveTab] = useState<TabType>("default")
  const [selectedLists, setSelectedLists] = useState<Set<string>>(new Set())
  const [isSaving, setIsSaving] = useState(false)
  const [mode, setMode] = useState<ModalMode>("add")

  // Create list modal state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newListName, setNewListName] = useState("")
  const [isCreating, setIsCreating] = useState(false)

  // Rename modal state
  const [listToRename, setListToRename] = useState<UserList | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [isRenaming, setIsRenaming] = useState(false)

  // Delete confirmation state
  const [listToDelete, setListToDelete] = useState<UserList | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Get media details
  const displayTitle =
    getDisplayMediaTitle(media, preferences.showOriginalTitles) || "Unknown"
  const title =
    ("title" in media ? media.title : undefined) ||
    ("name" in media ? media.name : undefined) ||
    displayTitle
  const originalTitle =
    ("original_title" in media ? media.original_title : undefined) || undefined
  const originalName =
    ("original_name" in media ? media.original_name : undefined) || undefined
  const mediaId = media.id
  const mediaKey = `${mediaType}-${mediaId}`
  const isPremiumCheckPending = isPremiumStatusPending({
    premiumLoading,
    premiumStatus,
  })
  const shouldRunFreeUserLimitCheck = shouldEnforcePremiumLock({
    premiumLoading,
    premiumStatus,
  })

  // Filter lists by type
  const defaultLists = useMemo(() => lists.filter((l) => !l.isCustom), [lists])
  const customLists = useMemo(() => lists.filter((l) => l.isCustom), [lists])

  // Initialize selected lists when modal opens or lists change
  useEffect(() => {
    if (!isOpen || listsLoading) return

    const initialSelected = new Set<string>()
    lists.forEach((list) => {
      if (!list.items) return

      // Check for item using both key formats:
      // - Numeric ID (mobile app format): "83533"
      // - Prefixed format (web format): "movie-83533"
      const numericKey = String(mediaId)
      const prefixedKey = mediaKey

      if (list.items[numericKey] || list.items[prefixedKey]) {
        initialSelected.add(list.id)
      }
    })
    setSelectedLists(initialSelected)
  }, [isOpen, lists, mediaId, mediaKey, listsLoading])

  // Reset state when modal closes
  const handleClose = useCallback(() => {
    setActiveTab("default")
    setSelectedLists(new Set())
    setMode("add")
    setShowCreateModal(false)
    setNewListName("")
    setListToRename(null)
    setListToDelete(null)
    onClose()
  }, [onClose])

  // Toggle list selection
  const toggleList = useCallback((listId: string) => {
    setSelectedLists((prev) => {
      const next = new Set(prev)
      if (next.has(listId)) {
        next.delete(listId)
      } else {
        next.add(listId)
      }
      return next
    })
  }, [])

  // Get icon for a list
  const getListIcon = useCallback((list: UserList) => {
    return LIST_ICONS[list.id] || FolderLibraryIcon
  }, [])

  // Check if item is in list (initial state) - check both key formats
  const isInList = useCallback(
    (listId: string) => {
      const list = lists.find((l) => l.id === listId)
      if (!list?.items) return false
      const numericKey = String(mediaId)
      return !!list.items[numericKey] || !!list.items[mediaKey]
    },
    [lists, mediaId, mediaKey],
  )

  const buildMediaItem = useCallback((): Omit<ListMediaItem, "addedAt"> => {
    const mediaItem: Omit<ListMediaItem, "addedAt"> = {
      id: mediaId,
      title: title || "Unknown",
      poster_path: "poster_path" in media ? media.poster_path : null,
      media_type: mediaType,
      vote_average: "vote_average" in media ? media.vote_average : 0,
      genre_ids:
        "genre_ids" in media
          ? media.genre_ids
          : "genres" in media
            ? media.genres?.map((g) => g.id)
            : [],
    }

    if (mediaType === "movie") {
      mediaItem.release_date =
        "release_date" in media ? media.release_date || "" : ""
      mediaItem.original_title = originalTitle
    }

    if (mediaType === "tv") {
      mediaItem.name = title || "Unknown"
      mediaItem.first_air_date =
        "first_air_date" in media ? media.first_air_date || "" : ""
      mediaItem.original_name = originalName
    }

    return mediaItem
  }, [media, mediaId, mediaType, originalName, originalTitle, title])

  // Handle save (add mode)
  const handleSave = useCallback(async () => {
    if (!user) return

    setIsSaving(true)

    try {
      const mediaItem = buildMediaItem()
      const mediaIdString = String(mediaId)
      const forwardOps: PreparedListOperation[] = []
      const undoOps: PreparedListOperation[] = []

      const applyListOperations = async (
        operations: PreparedListOperation[],
      ) => {
        const successfulOperations: PreparedListOperation[] = []

        for (const operation of operations) {
          try {
            if (operation.type === "add") {
              await addToList(operation.listId, operation.mediaItem)
            } else {
              await removeFromList(operation.listId, operation.mediaId)
            }

            successfulOperations.push(operation)
          } catch (error) {
            console.error(
              `Failed to ${operation.type} item for list "${operation.listName}":`,
              error,
            )

            const rollbackFailures: string[] = []

            for (const successfulOperation of [
              ...successfulOperations,
            ].reverse()) {
              try {
                if (successfulOperation.type === "add") {
                  await removeFromList(
                    successfulOperation.listId,
                    successfulOperation.rollbackMediaId,
                  )
                } else {
                  await addToList(
                    successfulOperation.listId,
                    successfulOperation.rollbackMediaItem,
                  )
                }
              } catch (rollbackError) {
                console.error(
                  `Failed to rollback ${successfulOperation.type} for list "${successfulOperation.listName}":`,
                  rollbackError,
                )
                rollbackFailures.push(successfulOperation.listName)
              }
            }

            const rollbackMessage =
              rollbackFailures.length === 0
                ? "Any earlier changes were rolled back."
                : `Rollback failed for ${formatListNames(rollbackFailures)}.`

            throw new Error(
              `Failed to update "${operation.listName}". ${rollbackMessage}`,
            )
          }
        }
      }

      // Process each list
      lists.forEach((list) => {
        const wasInList = isInList(list.id)
        const isNowSelected = selectedLists.has(list.id)
        const existingItemEntry = getStoredListItemEntry(
          list,
          mediaId,
          mediaKey,
        )

        if (!wasInList && isNowSelected) {
          forwardOps.push({
            type: "add",
            listId: list.id,
            listName: list.name,
            mediaItem,
            rollbackMediaId: mediaIdString,
          })
          undoOps.push({
            type: "remove",
            listId: list.id,
            listName: list.name,
            mediaId: mediaIdString,
            rollbackMediaItem: mediaItem,
          })
        } else if (wasInList && !isNowSelected) {
          if (!existingItemEntry) {
            throw new Error(
              `Couldn't prepare an update for "${list.name}". Please try again.`,
            )
          }

          const originalMediaItem = stripAddedAt(existingItemEntry.item)

          forwardOps.push({
            type: "remove",
            listId: list.id,
            listName: list.name,
            mediaId: existingItemEntry.itemKey,
            rollbackMediaItem: originalMediaItem,
          })
          undoOps.push({
            type: "add",
            listId: list.id,
            listName: list.name,
            mediaItem: originalMediaItem,
            rollbackMediaId: mediaIdString,
          })
        }
      })

      await applyListOperations(forwardOps)

      if (undoOps.length > 0) {
        const showUpdatedListsToast = () => {
          showActionableSuccessToast(`Updated lists for ${displayTitle}`, {
            action: {
              label: "Undo",
              onClick: async () => {
                try {
                  await applyListOperations(undoOps)
                } catch (error) {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : "Failed to undo changes",
                  )
                  return
                }

                showActionableSuccessToast("Changes undone", {
                  action: {
                    label: "Redo",
                    onClick: async () => {
                      try {
                        await applyListOperations(forwardOps)
                      } catch (error) {
                        toast.error(
                          error instanceof Error
                            ? error.message
                            : "Failed to redo changes",
                        )
                        return
                      }

                      showUpdatedListsToast()
                    },
                    errorMessage: "Failed to redo changes",
                    logMessage: "Redo failed",
                  },
                })
              },
              errorMessage: "Failed to undo changes",
              logMessage: "Undo failed",
            },
          })
        }

        showUpdatedListsToast()
      } else {
        showActionableSuccessToast(`Updated lists for ${displayTitle}`, {
          action: {
            label: "Close",
            onClick: () => undefined,
            errorMessage: "Failed to close toast",
          },
        })
      }

      handleClose()
    } catch (error) {
      console.error("Error saving lists:", error)
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update lists. Please try again.",
      )
    } finally {
      setIsSaving(false)
    }
  }, [
    user,
    lists,
    selectedLists,
    buildMediaItem,
    addToList,
    removeFromList,
    mediaId,
    mediaKey,
    isInList,
    handleClose,
    displayTitle,
  ])

  // Handle create custom list
  const handleCreateList = useCallback(async () => {
    if (!user || !newListName.trim()) return

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
          toast.error(
            `You've reached the limit of ${limit} custom lists. Upgrade to Premium for unlimited lists!`,
            {
              action: {
                label: "Upgrade",
                onClick: () => {
                  // Could navigate to a premium page in the future
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
      const listId = await createList(newListName.trim())
      const createdListName = newListName.trim()
      const mediaItem = buildMediaItem()
      const createdMediaId = String(mediaItem.id)

      // Add the media to the new list
      await addToList(listId, mediaItem)

      const undoCreateAndAdd = async () => {
        const currentList = await fetchUserList(user.uid, listId)

        if (!currentList) {
          return
        }

        const currentItemEntry = getStoredListItemEntry(
          currentList,
          mediaItem.id,
          mediaKey,
        )
        const currentItemCount = Object.keys(currentList.items ?? {}).length
        const isUnchangedCreatedList =
          currentList.name === createdListName &&
          currentItemCount === 1 &&
          currentItemEntry?.itemKey === createdMediaId

        if (isUnchangedCreatedList) {
          await deleteList(listId)
          return
        }

        if (!currentItemEntry) {
          console.info(
            `Undo skipped deleting "${currentList.name}" because the originally added item is already gone.`,
          )
          return
        }

        console.info(
          `Undo preserved changes to "${currentList.name}" and removed only the originally added item.`,
        )
        await removeFromList(listId, currentItemEntry.itemKey)
      }

      showActionableSuccessToast(
        `Created "${createdListName}" and added ${displayTitle}`,
        {
          action: {
            label: "Undo",
            onClick: undoCreateAndAdd,
            errorMessage: "Failed to undo list creation",
            logMessage: "Failed to undo create-and-add list flow:",
          },
        },
      )
      setShowCreateModal(false)
      setNewListName("")
      // Switch to custom tab to show the new list
      setActiveTab("custom")
    } catch (error) {
      console.error("Error creating list:", error)
      toast.error("Failed to create list. Please try again.")
    } finally {
      setIsCreating(false)
    }
  }, [
    addToList,
    buildMediaItem,
    createList,
    deleteList,
    removeFromList,
    isPremiumCheckPending,
    mediaKey,
    newListName,
    premiumStatus,
    shouldRunFreeUserLimitCheck,
    user,
    displayTitle,
  ])

  // Handle rename list
  const handleRenameList = useCallback(async () => {
    if (!user || !listToRename || !renameValue.trim()) return

    setIsRenaming(true)

    try {
      const previousName = listToRename.name
      await renameList(listToRename.id, renameValue.trim())
      showActionableSuccessToast(`Renamed list to "${renameValue.trim()}"`, {
        action: {
          label: "Undo",
          onClick: () => renameList(listToRename.id, previousName),
          errorMessage: "Failed to undo list rename",
          logMessage: "Failed to undo list rename:",
        },
      })
      setListToRename(null)
      setRenameValue("")
    } catch (error) {
      console.error("Error renaming list:", error)
      toast.error("Failed to rename list. Please try again.")
    } finally {
      setIsRenaming(false)
    }
  }, [user, listToRename, renameValue, renameList])

  // Handle delete list
  const handleDeleteList = useCallback(async () => {
    if (!user || !listToDelete) return

    setIsDeleting(true)

    try {
      const deletedList = listToDelete
      await deleteList(deletedList.id)
      showActionableSuccessToast(`Deleted "${deletedList.name}"`, {
        action: {
          label: "Undo",
          onClick: () => restoreList(user.uid, deletedList),
          errorMessage: "Failed to restore deleted list",
          logMessage: "Failed to undo list deletion:",
        },
      })
      setListToDelete(null)
    } catch (error) {
      console.error("Error deleting list:", error)
      toast.error("Failed to delete list. Please try again.")
    } finally {
      setIsDeleting(false)
    }
  }, [user, listToDelete, deleteList])

  // Open rename modal
  const openRenameModal = useCallback((list: UserList) => {
    setListToRename(list)
    setRenameValue(list.name)
  }, [])

  const currentLists = activeTab === "default" ? defaultLists : customLists

  return (
    <>
      {/* Main Modal */}
      <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {mode === "add" ? "Add to List" : "Manage Lists"}
            </DialogTitle>
            <DialogDescription>
              {mode === "add"
                ? `Save "${displayTitle}" to your lists`
                : "Rename or delete your custom lists"}
            </DialogDescription>
          </DialogHeader>

          {/* Tabs - only show in "add" mode */}
          {mode === "add" && (
            <div className="flex gap-2 border-b border-white/10 pb-2">
              <Button
                variant={activeTab === "default" ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveTab("default")}
                className={
                  activeTab === "default"
                    ? "bg-primary text-white"
                    : "text-gray-400 hover:text-white"
                }
              >
                Default Lists
              </Button>
              <Button
                variant={activeTab === "custom" ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveTab("custom")}
                className={
                  activeTab === "custom"
                    ? "bg-primary text-white"
                    : "text-gray-400 hover:text-white"
                }
              >
                Custom Lists
              </Button>
            </div>
          )}

          {/* List Items */}
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {listsLoading ? (
              <div className="flex items-center justify-center py-8">
                <HugeiconsIcon
                  icon={Loading03Icon}
                  className="size-6 animate-spin text-primary"
                />
              </div>
            ) : mode === "add" ? (
              // Add mode - show checkboxes
              currentLists.length === 0 ? (
                <div className="py-8 text-center text-sm text-gray-400">
                  {activeTab === "custom"
                    ? "No custom lists yet"
                    : "No lists available"}
                </div>
              ) : (
                currentLists.map((list) => (
                  <label
                    key={list.id}
                    className="flex cursor-pointer items-center gap-3 rounded-lg p-3 transition-colors hover:bg-white/5"
                  >
                    <Checkbox
                      checked={selectedLists.has(list.id)}
                      onCheckedChange={() => toggleList(list.id)}
                    />
                    <HugeiconsIcon
                      icon={getListIcon(list)}
                      className="size-5 text-gray-400"
                    />
                    <span className="flex-1 text-sm text-white">
                      {list.name}
                    </span>
                    <span className="text-xs text-gray-500">
                      {Object.keys(list.items || {}).length} items
                    </span>
                  </label>
                ))
              )
            ) : // Manage mode - show custom lists with edit/delete actions
            customLists.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400">
                No custom lists to manage
              </div>
            ) : (
              customLists.map((list) => (
                <div
                  key={list.id}
                  className="flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-white/5"
                >
                  <HugeiconsIcon
                    icon={FolderLibraryIcon}
                    className="size-5 text-gray-400"
                  />
                  <span className="flex-1 text-sm text-white">{list.name}</span>
                  <span className="mr-2 text-xs text-gray-500">
                    {Object.keys(list.items || {}).length} items
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-gray-400 hover:text-white"
                    onClick={() => openRenameModal(list)}
                  >
                    <HugeiconsIcon icon={PencilEdit01Icon} className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-gray-400 hover:text-red-500"
                    onClick={() => setListToDelete(list)}
                  >
                    <HugeiconsIcon icon={Delete02Icon} className="size-4" />
                  </Button>
                </div>
              ))
            )}
          </div>

          <DialogFooter className="flex flex-col gap-3 sm:flex-col">
            {/* Save/Done button */}
            <Button
              onClick={mode === "add" ? handleSave : () => setMode("add")}
              disabled={isSaving || listsLoading}
              className="w-full rounded-md"
            >
              {isSaving ? (
                <>
                  <HugeiconsIcon
                    icon={Loading03Icon}
                    className="size-4 animate-spin"
                  />
                  Saving...
                </>
              ) : mode === "add" ? (
                "Save"
              ) : (
                "Done"
              )}
            </Button>

            {/* Action buttons - only show in "add" mode */}
            {mode === "add" && (
              <div className="flex w-full gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setShowCreateModal(true)}
                >
                  <HugeiconsIcon icon={Add01Icon} className="mr-1.5 size-4" />
                  Create List
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setMode("manage")}
                  disabled={customLists.length === 0}
                >
                  <HugeiconsIcon
                    icon={Settings02Icon}
                    className="mr-1.5 size-4"
                  />
                  Manage
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create List Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Create Custom List</DialogTitle>
            <DialogDescription>
              Enter a name for your new list
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="List name"
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newListName.trim()) {
                handleCreateList()
              }
            }}
            autoFocus
          />
          {isPremiumCheckPending && (
            <p className="text-xs text-muted-foreground">
              {PREMIUM_LOADING_MESSAGE}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateModal(false)
                setNewListName("")
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateList}
              disabled={
                !newListName.trim() || isCreating || isPremiumCheckPending
              }
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

      {/* Rename List Modal */}
      <Dialog
        open={!!listToRename}
        onOpenChange={(open) => !open && setListToRename(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename List</DialogTitle>
            <DialogDescription>
              Enter a new name for &quot;{listToRename?.name}&quot;
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="New list name"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && renameValue.trim()) {
                handleRenameList()
              }
            }}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setListToRename(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleRenameList}
              disabled={!renameValue.trim() || isRenaming}
            >
              {isRenaming ? (
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
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog
        open={!!listToDelete}
        onOpenChange={(open) => !open && setListToDelete(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete List</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{listToDelete?.name}&quot;?
              This will remove all{" "}
              {Object.keys(listToDelete?.items || {}).length} items from this
              list. You can undo this from the success toast.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setListToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteList}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <HugeiconsIcon
                    icon={Loading03Icon}
                    className="mr-2 size-4 animate-spin"
                  />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
