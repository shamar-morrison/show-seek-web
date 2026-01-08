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
import { useLists } from "@/hooks/use-lists"
import {
  addToList,
  createList,
  deleteList,
  removeFromList,
  renameList,
} from "@/lib/firebase/lists"
import type { UserList } from "@/types/list"
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
  const { user, isPremium } = useAuth()
  const { lists, loading: listsLoading } = useLists()
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
  const title =
    "title" in media ? media.title : "name" in media ? media.name : "Unknown"
  const mediaId = media.id
  const mediaKey = `${mediaType}-${mediaId}`

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

  // Handle save (add mode)
  const handleSave = useCallback(async () => {
    if (!user) return

    setIsSaving(true)

    try {
      const promises: Promise<void | boolean>[] = []

      // Build media item for adding - only include defined values
      const mediaItem: Record<string, unknown> = {
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

      // Add movie-specific fields
      if (mediaType === "movie") {
        mediaItem.release_date =
          "release_date" in media ? media.release_date || "" : ""
      }

      // Add TV-specific fields
      if (mediaType === "tv") {
        mediaItem.name = title || "Unknown"
        mediaItem.first_air_date =
          "first_air_date" in media ? media.first_air_date || "" : ""
      }

      // Process each list
      lists.forEach((list) => {
        const wasInList = isInList(list.id)
        const isNowSelected = selectedLists.has(list.id)

        if (!wasInList && isNowSelected) {
          // Add to list
          promises.push(
            addToList(
              user.uid,
              list.id,
              mediaItem as Omit<
                import("@/types/list").ListMediaItem,
                "addedAt"
              >,
            ),
          )
        } else if (wasInList && !isNowSelected) {
          // Remove from list
          promises.push(removeFromList(user.uid, list.id, String(mediaId)))
        }
      })

      await Promise.all(promises)
      toast.success(`Updated lists for ${title}`)
      handleClose()
    } catch (error) {
      console.error("Error saving lists:", error)
      toast.error("Failed to update lists. Please try again.")
    } finally {
      setIsSaving(false)
    }
  }, [
    user,
    lists,
    selectedLists,
    media,
    mediaId,
    mediaType,
    title,
    isInList,
    handleClose,
  ])

  // Handle create custom list
  const handleCreateList = useCallback(async () => {
    if (!user || !newListName.trim()) return

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
      const listId = await createList(user.uid, newListName.trim())

      // Build media item
      const mediaItem: Record<string, unknown> = {
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
      }
      if (mediaType === "tv") {
        mediaItem.name = title || "Unknown"
        mediaItem.first_air_date =
          "first_air_date" in media ? media.first_air_date || "" : ""
      }

      // Add the media to the new list
      await addToList(
        user.uid,
        listId,
        mediaItem as Omit<import("@/types/list").ListMediaItem, "addedAt">,
      )

      toast.success(`Created "${newListName.trim()}" and added ${title}`)
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
  }, [user, isPremium, newListName, media, mediaId, mediaType, title])

  // Handle rename list
  const handleRenameList = useCallback(async () => {
    if (!user || !listToRename || !renameValue.trim()) return

    setIsRenaming(true)

    try {
      await renameList(user.uid, listToRename.id, renameValue.trim())
      toast.success(`Renamed list to "${renameValue.trim()}"`)
      setListToRename(null)
      setRenameValue("")
    } catch (error) {
      console.error("Error renaming list:", error)
      toast.error("Failed to rename list. Please try again.")
    } finally {
      setIsRenaming(false)
    }
  }, [user, listToRename, renameValue])

  // Handle delete list
  const handleDeleteList = useCallback(async () => {
    if (!user || !listToDelete) return

    setIsDeleting(true)

    try {
      await deleteList(user.uid, listToDelete.id)
      toast.success(`Deleted "${listToDelete.name}"`)
      setListToDelete(null)
    } catch (error) {
      console.error("Error deleting list:", error)
      toast.error("Failed to delete list. Please try again.")
    } finally {
      setIsDeleting(false)
    }
  }, [user, listToDelete])

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
                ? `Save "${title}" to your lists`
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
              disabled={!newListName.trim() || isCreating}
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
              list. This action cannot be undone.
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
