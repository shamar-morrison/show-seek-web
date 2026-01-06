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
import { useAuth } from "@/context/auth-context"
import { useLists } from "@/hooks/use-lists"
import { addToList, removeFromList } from "@/lib/firebase/lists"
import type { UserList } from "@/types/list"
import type { TMDBMedia, TMDBMovieDetails, TMDBTVDetails } from "@/types/tmdb"
import {
  Bookmark02Icon,
  Cancel01Icon,
  FavouriteIcon,
  FolderLibraryIcon,
  Loading03Icon,
  PlayCircle02Icon,
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
 */
export function AddToListModal({
  isOpen,
  onClose,
  media,
  mediaType,
}: AddToListModalProps) {
  const { user } = useAuth()
  const { lists, loading: listsLoading } = useLists()
  const [activeTab, setActiveTab] = useState<TabType>("default")
  const [selectedLists, setSelectedLists] = useState<Set<string>>(new Set())
  const [isSaving, setIsSaving] = useState(false)

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

  // Handle save
  const handleSave = useCallback(async () => {
    if (!user) return

    setIsSaving(true)

    try {
      const promises: Promise<void>[] = []

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

  const currentLists = activeTab === "default" ? defaultLists : customLists

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Add to List</DialogTitle>
          <DialogDescription>
            Save &quot;{title}&quot; to your lists
          </DialogDescription>
        </DialogHeader>

        {/* Tabs */}
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

        {/* List Items */}
        <div className="max-h-64 space-y-1 overflow-y-auto">
          {listsLoading ? (
            <div className="flex items-center justify-center py-8">
              <HugeiconsIcon
                icon={Loading03Icon}
                className="size-6 animate-spin text-primary"
              />
            </div>
          ) : currentLists.length === 0 ? (
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
                <span className="flex-1 text-sm text-white">{list.name}</span>
                <span className="text-xs text-gray-500">
                  {Object.keys(list.items || {}).length} items
                </span>
              </label>
            ))
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={handleSave}
            disabled={isSaving || listsLoading}
            className="w-full"
          >
            {isSaving ? (
              <>
                <HugeiconsIcon
                  icon={Loading03Icon}
                  className="size-4 animate-spin"
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
  )
}
