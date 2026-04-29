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
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/context/auth-context"
import { useBulkListOperations } from "@/hooks/use-bulk-list-operations"
import { useListMutations } from "@/hooks/use-list-mutations"
import { useLists } from "@/hooks/use-lists"
import { usePreferences } from "@/hooks/use-preferences"
import { showActionableSuccessToast } from "@/lib/actionable-toast"
import { fetchUserList, restoreList } from "@/lib/firebase/lists"
import {
  getStoredListItemEntry,
  hasStoredListItem,
} from "@/lib/list-item-keys"
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
import type { ListMediaItem, ListWriteMediaItem, UserList } from "@/types/list"
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
import { useCallback, useEffect, useId, useMemo, useState } from "react"
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
      mediaItem: ListMediaItem
      rollbackMediaId: string
    }
  | {
      type: "remove"
      listId: string
      listName: string
      mediaId: string
      rollbackMediaItem: ListMediaItem
    }

interface BaseAddToListModalProps {
  /** Whether the modal is open */
  isOpen: boolean
  /** Callback when modal should close */
  onClose: () => void
  /** Called after a successful bulk operation finishes */
  onComplete?: () => void
}

interface SingleAddToListModalProps extends BaseAddToListModalProps {
  /** The media item to add to lists */
  media: TMDBMedia | TMDBMovieDetails | TMDBTVDetails
  /** Media type */
  mediaType: "movie" | "tv"
  mediaItems?: never
  sourceListId?: never
  bulkAddMode?: never
}

interface BulkAddToListModalProps extends BaseAddToListModalProps {
  media?: never
  mediaType?: never
  mediaItems: ListWriteMediaItem[]
  sourceListId: string
  bulkAddMode: "copy" | "move"
}

type AddToListModalProps =
  | SingleAddToListModalProps
  | BulkAddToListModalProps

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
 * Also supports creating, editing, and deleting custom lists
 */
export function AddToListModal({
  isOpen,
  onClose,
  onComplete,
  ...props
}: AddToListModalProps) {
  const { user, premiumLoading, premiumStatus } = useAuth()
  const { lists, loading: listsLoading } = useLists()
  const { preferences } = usePreferences()
  const { transferItems } = useBulkListOperations()
  const { addToList, removeFromList, createList, updateList, deleteList } =
    useListMutations()
  const [activeTab, setActiveTab] = useState<TabType>("default")
  const [selectedLists, setSelectedLists] = useState<Set<string>>(new Set())
  const [isSaving, setIsSaving] = useState(false)
  const [mode, setMode] = useState<ModalMode>("add")
  const [operationError, setOperationError] = useState<string | null>(null)

  // Create list modal state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newListName, setNewListName] = useState("")
  const [newListDescription, setNewListDescription] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const createListNameId = useId()
  const createListDescriptionId = useId()

  // Edit list modal state
  const [listToEdit, setListToEdit] = useState<UserList | null>(null)
  const [editName, setEditName] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [isEditing, setIsEditing] = useState(false)
  const editListNameId = useId()
  const editListDescriptionId = useId()

  // Delete confirmation state
  const [listToDelete, setListToDelete] = useState<UserList | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const isBulkMode = "mediaItems" in props
  const singleMedia = isBulkMode ? null : props.media
  const singleMediaType = isBulkMode ? null : props.mediaType
  const bulkMediaItems: ListWriteMediaItem[] = isBulkMode
    ? props.mediaItems ?? []
    : []
  const sourceListId: string | null = isBulkMode
    ? props.sourceListId ?? null
    : null
  const bulkAddMode: "copy" | "move" = isBulkMode
    ? props.bulkAddMode ?? "move"
    : preferences.copyInsteadOfMove
      ? "copy"
      : "move"

  // Get media details
  const displayTitle = isBulkMode
    ? null
    : singleMedia
      ? getDisplayMediaTitle(singleMedia, preferences.showOriginalTitles) ||
        "Unknown"
      : "Unknown"
  const title = isBulkMode
    ? null
    : (singleMedia && "title" in singleMedia ? singleMedia.title : undefined) ||
      (singleMedia && "name" in singleMedia ? singleMedia.name : undefined) ||
      displayTitle
  const originalTitle = isBulkMode
    ? undefined
    : (singleMedia && "original_title" in singleMedia
        ? singleMedia.original_title
        : undefined) || undefined
  const originalName = isBulkMode
    ? undefined
    : (singleMedia && "original_name" in singleMedia
        ? singleMedia.original_name
        : undefined) || undefined
  const mediaId = singleMedia?.id ?? null
  const isPremiumCheckPending = isPremiumStatusPending({
    premiumLoading,
    premiumStatus,
  })
  const shouldRunFreeUserLimitCheck = shouldEnforcePremiumLock({
    premiumLoading,
    premiumStatus,
  })

  // Filter lists by type
  const selectableLists = useMemo(
    () =>
      isBulkMode && sourceListId
        ? lists.filter((list) => list.id !== sourceListId)
        : lists,
    [isBulkMode, lists, sourceListId],
  )
  const defaultLists = useMemo(
    () => selectableLists.filter((l) => !l.isCustom),
    [selectableLists],
  )
  const customLists = useMemo(
    () => selectableLists.filter((l) => l.isCustom),
    [selectableLists],
  )

  // Initialize selected lists when modal opens or lists change
  useEffect(() => {
    if (!isOpen || listsLoading) return

    if (isBulkMode) {
      setSelectedLists(new Set())
      return
    }

    const initialSelected = new Set<string>()
    lists.forEach((list) => {
      if (
        singleMediaType &&
        mediaId !== null &&
        hasStoredListItem(list.items, singleMediaType, mediaId)
      ) {
        initialSelected.add(list.id)
      }
    })
    setSelectedLists(initialSelected)
  }, [isBulkMode, isOpen, lists, listsLoading, mediaId, singleMediaType])

  // Reset state when modal closes
  const handleClose = useCallback(() => {
    setActiveTab("default")
    setSelectedLists(new Set())
    setMode("add")
    setOperationError(null)
    setShowCreateModal(false)
    setNewListName("")
    setNewListDescription("")
    setListToEdit(null)
    setEditName("")
    setEditDescription("")
    setListToDelete(null)
    onClose()
  }, [onClose])

  const resetCreateModalState = useCallback(() => {
    setNewListName("")
    setNewListDescription("")
  }, [])

  const handleCloseCreateModal = useCallback(() => {
    if (isCreating) return
    resetCreateModalState()
    setShowCreateModal(false)
  }, [isCreating, resetCreateModalState])

  // Toggle list selection
  const toggleList = useCallback((listId: string) => {
    setOperationError(null)
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
      return isBulkMode || !mediaId
        ? false
        : hasStoredListItem(list?.items, singleMediaType!, mediaId)
    },
    [isBulkMode, lists, mediaId, singleMediaType],
  )

  const buildMediaItem = useCallback((): ListMediaItem => {
    if (isBulkMode || mediaId === null || !title) {
      throw new Error("Cannot build a single-media payload in bulk mode")
    }

    const mediaItem: ListMediaItem = {
      id: mediaId,
      title: title || "Unknown",
      poster_path:
        singleMedia && "poster_path" in singleMedia ? singleMedia.poster_path : null,
      media_type: singleMediaType!,
      addedAt: Date.now(),
      vote_average:
        singleMedia && "vote_average" in singleMedia ? singleMedia.vote_average : 0,
      genre_ids:
        singleMedia && "genre_ids" in singleMedia
          ? singleMedia.genre_ids
          : singleMedia && "genres" in singleMedia
            ? singleMedia.genres?.map((g) => g.id)
            : [],
    }

    if (singleMediaType === "movie") {
      mediaItem.release_date =
        singleMedia && "release_date" in singleMedia
          ? singleMedia.release_date || ""
          : ""
      mediaItem.original_title = originalTitle
    }

    if (singleMediaType === "tv") {
      mediaItem.name = title || "Unknown"
      mediaItem.first_air_date =
        singleMedia && "first_air_date" in singleMedia
          ? singleMedia.first_air_date || ""
          : ""
      mediaItem.original_name = originalName
    }

    return mediaItem
  }, [
    isBulkMode,
    mediaId,
    originalName,
    originalTitle,
    singleMedia,
    singleMediaType,
    title,
  ])

  // Handle save (add mode)
  const handleSave = useCallback(async () => {
    if (!user) return

    setIsSaving(true)
    setOperationError(null)

    try {
      if (isBulkMode) {
        const targetListIds = Array.from(selectedLists)
        const { failedOperations, totalOperations } = await transferItems({
          sourceListId: sourceListId!,
          targetListIds,
          mediaItems: bulkMediaItems,
          mode: bulkAddMode,
        })

        if (failedOperations === 0) {
          if (totalOperations === 0) {
            toast.info("Selected items are already in those lists.")
          } else {
            toast.success(
              bulkAddMode === "copy"
                ? "Items copied to lists"
                : "Items moved to lists",
            )
          }
          handleClose()
          onComplete?.()
          return
        }

        setOperationError(
          failedOperations < totalOperations
            ? `Failed to save ${failedOperations} of ${totalOperations} changes.`
            : "Failed to save changes. Please try again.",
        )
        return
      }

      const mediaItem = buildMediaItem()
      const mediaIdString = String(mediaId!)
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
          list.items,
          singleMediaType!,
          mediaId!,
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

          const originalMediaItem = existingItemEntry.item

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

      if (forwardOps.length > 0) {
        const showUpdatedListsToast = () => {
          showActionableSuccessToast(`Updated lists for ${displayTitle ?? "item"}`, {
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
        toast.info("No changes to save")
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
    isBulkMode,
    selectedLists,
    transferItems,
    props,
    handleClose,
    onComplete,
    buildMediaItem,
    lists,
    isInList,
    addToList,
    removeFromList,
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
      const trimmedDescription = newListDescription.trim()
      const listId = await createList(
        newListName.trim(),
        trimmedDescription || undefined,
      )
      const createdListName = newListName.trim()
      const mediaItem = isBulkMode ? null : buildMediaItem()
      const createdMediaId = mediaItem ? String(mediaItem.id) : null

      if (isBulkMode) {
        setSelectedLists((prev) => new Set(prev).add(listId))
        resetCreateModalState()
        setShowCreateModal(false)
        setMode("add")
        setActiveTab("custom")
        toast.success(`Created "${createdListName}"`)
        return
      }

      // Add the media to the new list
      await addToList(listId, mediaItem!)

      const undoCreateAndAdd = async () => {
        const currentList = await fetchUserList(user.uid, listId)

        if (!currentList) {
          return
        }

        const currentItemEntry = getStoredListItemEntry(
          currentList.items,
          singleMediaType!,
          mediaItem!.id,
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
      resetCreateModalState()
      setShowCreateModal(false)
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
    isBulkMode,
    props,
    isPremiumCheckPending,
    newListName,
    newListDescription,
    premiumStatus,
    shouldRunFreeUserLimitCheck,
    user,
    displayTitle,
    resetCreateModalState,
  ])

  // Handle edit list details
  const handleEditList = useCallback(async () => {
    if (!user || !listToEdit || !editName.trim()) return

    setIsEditing(true)

    try {
      const listId = listToEdit.id
      const previousName = listToEdit.name
      const previousDescription = listToEdit.description?.trim() || ""
      const nextName = editName.trim()
      const nextDescription = editDescription

      await updateList(listId, nextName, nextDescription)
      showActionableSuccessToast(`Updated "${nextName}"`, {
        action: {
          label: "Undo",
          onClick: () => updateList(listId, previousName, previousDescription),
          errorMessage: "Failed to undo list edit",
          logMessage: "Failed to undo list edit:",
        },
      })
      setListToEdit(null)
      setEditName("")
      setEditDescription("")
    } catch (error) {
      console.error("Error updating list:", error)
      toast.error("Failed to update list. Please try again.")
    } finally {
      setIsEditing(false)
    }
  }, [editDescription, editName, listToEdit, updateList, user])

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
          onClick: async () => {
            const restored = await restoreList(user.uid, deletedList)

            if (!restored) {
              toast.info("List was not restored.")
            }
          },
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

  // Open edit modal
  const openEditModal = useCallback((list: UserList) => {
    setListToEdit(list)
    setEditName(list.name)
    setEditDescription(list.description?.trim() || "")
  }, [])

  const handleCloseEditModal = useCallback(() => {
    if (isEditing) return
    setListToEdit(null)
    setEditName("")
    setEditDescription("")
  }, [isEditing])

  const currentLists = activeTab === "default" ? defaultLists : customLists
  const modalTitle =
    mode === "manage"
      ? "Manage Lists"
      : isBulkMode
        ? bulkAddMode === "copy"
          ? "Copy to Lists"
          : "Move to Lists"
        : "Add to List"
  const modalDescription =
    mode === "manage"
      ? "Edit details or delete your custom lists"
      : isBulkMode
        ? `${bulkMediaItems.length} selected item${
            bulkMediaItems.length === 1 ? "" : "s"
          }`
        : `Save "${displayTitle}" to your lists`
  const isSaveDisabled =
    isSaving ||
    listsLoading ||
    (isBulkMode && selectedLists.size === 0)

  return (
    <>
      {/* Main Modal */}
      <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">{modalTitle}</DialogTitle>
            <DialogDescription>{modalDescription}</DialogDescription>
          </DialogHeader>

          {operationError ? (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {operationError}
            </div>
          ) : null}

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
                  data-testid={`custom-list-row-${list.id}`}
                  className="flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-white/5"
                >
                  <HugeiconsIcon
                    icon={FolderLibraryIcon}
                    className="size-5 text-gray-400"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-white">
                      {list.name}
                    </span>
                    {list.description?.trim() ? (
                      <span className="block truncate text-xs text-gray-500">
                        {list.description.trim()}
                      </span>
                    ) : null}
                  </div>
                  <span className="mr-2 text-xs text-gray-500">
                    {Object.keys(list.items || {}).length} items
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-gray-400 hover:text-white"
                    onClick={() => openEditModal(list)}
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
              disabled={isSaveDisabled}
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
                {!isBulkMode ? (
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
                ) : null}
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create List Modal */}
      <Dialog
        open={showCreateModal}
        onOpenChange={(open) => {
          if (!open) {
            handleCloseCreateModal()
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Custom List</DialogTitle>
            <DialogDescription>
              Enter a name and optional description for your new list
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor={createListNameId}>List name</Label>
              <Input
                id={createListNameId}
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
            </div>
            <div className="grid gap-2">
              <Label htmlFor={createListDescriptionId}>
                Description (optional)
              </Label>
              <Textarea
                id={createListDescriptionId}
                placeholder="What is this list for?"
                value={newListDescription}
                onChange={(e) => setNewListDescription(e.target.value)}
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
            <Button
              variant="outline"
              onClick={handleCloseCreateModal}
              disabled={isCreating}
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

      {/* Edit List Modal */}
      <Dialog
        open={!!listToEdit}
        onOpenChange={(open) => !open && handleCloseEditModal()}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit List Details</DialogTitle>
            <DialogDescription>
              Update the name and description for &quot;{listToEdit?.name}
              &quot;
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor={editListNameId}>List name</Label>
              <Input
                id={editListNameId}
                placeholder="List name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && editName.trim()) {
                    handleEditList()
                  }
                }}
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={editListDescriptionId}>Description (optional)</Label>
              <Textarea
                id={editListDescriptionId}
                placeholder="What is this list for?"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                maxLength={120}
                rows={4}
                className="min-h-24 resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCloseEditModal}
              disabled={isEditing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleEditList}
              disabled={!editName.trim() || isEditing}
            >
              {isEditing ? (
                <>
                  <HugeiconsIcon
                    icon={Loading03Icon}
                    className="mr-2 size-4 animate-spin"
                  />
                  Saving...
                </>
              ) : (
                "Save Changes"
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
