"use client"

import { MediaCard } from "@/components/media-card"
import { TrailerModal } from "@/components/trailer-modal"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { FilterTabButton } from "@/components/ui/filter-tab-button"
import { Input } from "@/components/ui/input"
import { useLists } from "@/hooks/use-lists"
import { useTrailer } from "@/hooks/use-trailer"
import type { ListMediaItem, UserList } from "@/types/list"
import type { TMDBMedia } from "@/types/tmdb"
import {
  Bookmark02Icon,
  Cancel01Icon,
  FavouriteIcon,
  Loading03Icon,
  PlayCircle02Icon,
  Search01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useCallback, useMemo, useState } from "react"

/** Map list IDs to icons */
const LIST_ICONS: Record<string, typeof Bookmark02Icon> = {
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
    original_title: item.title,
    original_name: item.name,
    overview: "",
    genre_ids: item.genre_ids || [],
    popularity: 0,
    release_date: item.release_date,
    first_air_date: item.first_air_date,
    vote_average: item.vote_average,
    vote_count: 0,
    original_language: "",
  }
}

/**
 * Watch Lists Client Component
 * Displays user's lists with tab navigation and search filtering
 */
export function WatchListsClient() {
  const { lists, loading, error } = useLists()
  const [activeListId, setActiveListId] = useState<string>("watchlist")
  const [searchQuery, setSearchQuery] = useState("")

  // Trailer hook
  const { isOpen, activeTrailer, loadingMediaId, watchTrailer, closeTrailer } =
    useTrailer()

  // Get the active list
  const activeList = useMemo(
    () => lists.find((l) => l.id === activeListId),
    [lists, activeListId],
  )

  // Get items from the active list
  const listItems = useMemo(() => {
    if (!activeList) return []
    return Object.values(activeList.items).sort(
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

  // Filter to only default lists (non-custom)
  const defaultLists = lists.filter((l) => !l.isCustom)

  return (
    <div className="space-y-8 pb-12">
      {/* Search and Tabs */}
      <div className="space-y-6">
        {/* Search Input */}
        <div className="relative max-w-2xl">
          <HugeiconsIcon
            icon={Search01Icon}
            className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-gray-400"
          />
          <Input
            type="text"
            placeholder="Search in this list..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-12 rounded-xl border-white/10 bg-white/5 pl-12 pr-4 text-lg text-white placeholder:text-gray-500 focus:border-primary/50 focus:ring-primary/20"
          />
        </div>

        {/* List Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {defaultLists.map((list) => (
            <FilterTabButton
              key={list.id}
              label={list.name}
              count={getItemCount(list)}
              isActive={activeListId === list.id}
              icon={LIST_ICONS[list.id] || Bookmark02Icon}
              onClick={() => setActiveListId(list.id)}
            />
          ))}
        </div>
      </div>

      {/* Results */}
      {filteredItems.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7">
          {filteredItems.map((item) => (
            <MediaCard
              key={`${item.media_type}-${item.id}`}
              media={listItemToMedia(item)}
              onWatchTrailer={handleWatchTrailer}
              isLoading={loadingMediaId === item.id}
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
              No items in &quot;{activeList?.name}&quot; match &quot;
              {searchQuery}&quot;
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Empty className="py-20">
          <EmptyMedia variant="icon">
            <HugeiconsIcon
              icon={LIST_ICONS[activeListId] || Bookmark02Icon}
              className="size-6"
            />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>No items yet</EmptyTitle>
            <EmptyDescription>
              Add movies or TV shows to your &quot;{activeList?.name}&quot; list
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
