"use client"

import { MediaCardWithActions } from "@/components/media-card-with-actions"
import { TrailerModal } from "@/components/trailer-modal"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { FilterTabButton } from "@/components/ui/filter-tab-button"
import { SearchInput } from "@/components/ui/search-input"
import { useTrailer } from "@/hooks/use-trailer"
import type { ListMediaItem, UserList } from "@/types/list"
import type { TMDBMedia } from "@/types/tmdb"
import {
  Bookmark02Icon,
  Cancel01Icon,
  FavouriteIcon,
  FolderLibraryIcon,
  Loading03Icon,
  PlayCircle02Icon,
  Search01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useCallback, useMemo, useState } from "react"

/** Map list IDs to icons for default lists */
export const DEFAULT_LIST_ICONS: Record<string, typeof Bookmark02Icon> = {
  watchlist: Bookmark02Icon,
  "currently-watching": PlayCircle02Icon,
  "already-watched": Tick02Icon,
  favorites: FavouriteIcon,
  dropped: Cancel01Icon,
}

/** Convert ListMediaItem to TMDBMedia for MediaCard compatibility */
function listItemToMedia(item: ListMediaItem): TMDBMedia {
  return {
    id: item.id,
    media_type: item.media_type,
    adult: false,
    backdrop_path: null,
    poster_path: item.poster_path,
    title: item.media_type === "movie" ? item.title : undefined,
    name: item.media_type === "tv" ? item.name || item.title : undefined,
    overview: "",
    genre_ids: item.genre_ids || [],
    popularity: 0,
    release_date: item.release_date,
    first_air_date: item.first_air_date,
    vote_average: item.vote_average ?? 0,
    vote_count: 0,
    original_language: "",
    // Conditionally set original_title/original_name based on media_type
    // to avoid polluting the object with undefined values
    ...(item.media_type === "movie"
      ? { original_title: item.title }
      : { original_name: item.name || item.title }),
  }
}

interface ListsPageClientProps {
  /** Lists to display as tabs */
  lists: UserList[]
  /** Loading state */
  loading: boolean
  /** Error state */
  error: Error | null
  /** Default icon for tabs without a specific icon */
  defaultIcon?: typeof Bookmark02Icon
  /** Empty state message when no lists exist */
  noListsMessage?: string
  /** Empty state title when no lists exist */
  noListsTitle?: string
}

/**
 * Reusable Lists Page Client Component
 * Displays lists with tab navigation and search filtering
 */
export function ListsPageClient({
  lists,
  loading,
  error,
  defaultIcon = FolderLibraryIcon,
  noListsMessage = "Create a custom list to get started",
  noListsTitle = "No lists yet",
}: ListsPageClientProps) {
  const [selectedListId, setSelectedListId] = useState<string>("")
  const [searchQuery, setSearchQuery] = useState("")

  // Trailer hook
  const { isOpen, activeTrailer, loadingMediaId, watchTrailer, closeTrailer } =
    useTrailer()

  // Derive effective active list ID - use selected if valid, otherwise default to first list
  const activeListId = useMemo(() => {
    if (selectedListId && lists.some((l) => l.id === selectedListId)) {
      return selectedListId
    }
    return lists.length > 0 ? lists[0].id : ""
  }, [selectedListId, lists])

  // Get the active list
  const activeList = useMemo(
    () => lists.find((l) => l.id === activeListId),
    [lists, activeListId],
  )

  // Get items from the active list
  const listItems = useMemo(() => {
    if (!activeList) return []
    return Object.values(activeList.items || {}).sort(
      (a, b) => (b.addedAt || 0) - (a.addedAt || 0),
    )
  }, [activeList])

  // Filter items by search query
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return listItems
    const query = searchQuery.toLowerCase()
    return listItems.filter((item) => {
      const title = (item.title || item.name || "").toLowerCase()
      return title.includes(query)
    })
  }, [listItems, searchQuery])

  // Get item count for each list
  const getItemCount = useCallback(
    (list: UserList) => Object.keys(list.items || {}).length,
    [],
  )

  // Get icon for a list
  const getListIcon = useCallback(
    (list: UserList) => DEFAULT_LIST_ICONS[list.id] || defaultIcon,
    [defaultIcon],
  )

  // Handle trailer click
  const handleWatchTrailer = useCallback(
    (media: TMDBMedia) => {
      if (media.media_type === "person") return
      watchTrailer(
        media.id,
        media.media_type,
        media.title || media.name || "Trailer",
      )
    },
    [watchTrailer],
  )

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <HugeiconsIcon
          icon={Loading03Icon}
          className="size-8 animate-spin text-primary"
        />
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <Empty className="py-20">
        <EmptyMedia variant="icon">
          <HugeiconsIcon icon={Cancel01Icon} className="size-6" />
        </EmptyMedia>
        <EmptyHeader>
          <EmptyTitle>Failed to load lists</EmptyTitle>
          <EmptyDescription>
            Please try again later or check your connection.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  // No lists state
  if (lists.length === 0) {
    return (
      <Empty className="py-20">
        <EmptyMedia variant="icon">
          <HugeiconsIcon icon={defaultIcon} className="size-6" />
        </EmptyMedia>
        <EmptyHeader>
          <EmptyTitle>{noListsTitle}</EmptyTitle>
          <EmptyDescription>{noListsMessage}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  const activeListIcon = activeList ? getListIcon(activeList) : defaultIcon
  const activeListName = activeList?.name ?? "Untitled"

  return (
    <div className="space-y-8 pb-12">
      {/* Search and Tabs */}
      <div className="space-y-6">
        {/* Search Input */}
        <SearchInput
          id="lists-search-input"
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search in this list..."
        />

        {/* List Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {lists.map((list) => (
            <FilterTabButton
              key={list.id}
              label={list.name}
              count={getItemCount(list)}
              isActive={activeListId === list.id}
              icon={getListIcon(list)}
              onClick={() => setSelectedListId(list.id)}
            />
          ))}
        </div>
      </div>

      {/* Results */}
      {filteredItems.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7">
          {filteredItems.map((item) => (
            <MediaCardWithActions
              key={`${item.media_type}-${item.id}`}
              media={listItemToMedia(item)}
              onWatchTrailer={handleWatchTrailer}
              isLoading={loadingMediaId === `${item.media_type}-${item.id}`}
            />
          ))}
        </div>
      ) : listItems.length > 0 && searchQuery.trim() ? (
        <Empty className="py-20">
          <EmptyMedia variant="icon">
            <HugeiconsIcon icon={Search01Icon} className="size-6" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>No results found</EmptyTitle>
            <EmptyDescription>
              No items in &quot;{activeListName}&quot; match &quot;
              {searchQuery}&quot;
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Empty className="py-20">
          <EmptyMedia variant="icon">
            <HugeiconsIcon icon={activeListIcon} className="size-6" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>No items yet</EmptyTitle>
            <EmptyDescription>
              Add movies or TV shows to your &quot;{activeListName}&quot; list
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {/* Trailer Modal */}
      <TrailerModal
        videoKey={activeTrailer?.key || null}
        isOpen={isOpen}
        onClose={closeTrailer}
        title={activeTrailer?.title || "Trailer"}
      />
    </div>
  )
}
