"use client"

import { MediaCardWithActions } from "@/components/media-card-with-actions"
import { PageHeader } from "@/components/page-header"
import { TrailerModal } from "@/components/trailer-modal"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { FilterSort, FilterState, SortState } from "@/components/ui/filter-sort"
import { FilterTabButton } from "@/components/ui/filter-tab-button"
import { SearchInput } from "@/components/ui/search-input"
import { useTrailer } from "@/hooks/use-trailer"
import type { ListMediaItem, UserList } from "@/types/list"
import type { Genre, TMDBMedia } from "@/types/tmdb"
import {
  Bookmark02Icon,
  Cancel01Icon,
  FavouriteIcon,
  Film01Icon,
  FolderLibraryIcon,
  Loading03Icon,
  PlayCircle02Icon,
  Search01Icon,
  Tick02Icon,
  Tv01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useCallback, useEffect, useMemo, useState } from "react"

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

// Current year for year range filter
const CURRENT_YEAR = new Date().getFullYear()
const MIN_YEAR = 1950

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
  /** Movie genres for filter options */
  movieGenres?: Genre[]
  /** TV genres for filter options */
  tvGenres?: Genre[]
  /** Optional controlled selected list ID */
  selectedListId?: string
  /** Callback when list selection changes */
  onListSelect?: (listId: string) => void
  /** Whether to show the dynamic page header with the list name */
  showDynamicHeader?: boolean
  /** Optional action element to render next to the header title */
  headerAction?: React.ReactNode
  /** Optional action element to render in the empty state */
  emptyStateAction?: React.ReactNode
}

/**
 * Reusable Lists Page Client Component
 * Displays lists with tab navigation, search filtering, and sort/filter options
 */
export function ListsPageClient({
  lists,
  loading,
  error,
  defaultIcon = FolderLibraryIcon,
  noListsMessage = "Create a custom list to get started",
  noListsTitle = "No lists yet",
  movieGenres = [],
  tvGenres = [],
  selectedListId: controlledSelectedListId,
  onListSelect,
  showDynamicHeader = false,
  headerAction,
  emptyStateAction,
}: ListsPageClientProps) {
  const [internalSelectedListId, setInternalSelectedListId] =
    useState<string>("")
  const [searchQuery, setSearchQuery] = useState("")

  // Use controlled state if provided, otherwise internal state
  const selectedListId =
    controlledSelectedListId !== undefined
      ? controlledSelectedListId
      : internalSelectedListId

  const handleListSelect = useCallback(
    (id: string) => {
      if (onListSelect) {
        onListSelect(id)
      } else {
        setInternalSelectedListId(id)
      }
    },
    [onListSelect],
  )

  // Set default selection when lists load
  useEffect(() => {
    if (
      !loading &&
      lists.length > 0 &&
      !selectedListId &&
      controlledSelectedListId === undefined
    ) {
      handleListSelect(lists[0].id)
    }
  }, [
    loading,
    lists,
    selectedListId,
    controlledSelectedListId,
    handleListSelect,
  ])

  // Filter state
  const [filterState, setFilterState] = useState<FilterState>({
    mediaType: "all",
    genre: "all",
  })
  const [yearRange, setYearRange] = useState<[number, number]>([
    MIN_YEAR,
    CURRENT_YEAR,
  ])
  const [minRating, setMinRating] = useState<number>(0)

  // Sort state
  const [sortState, setSortState] = useState<SortState>({
    field: "added",
    direction: "desc",
  })

  // Trailer hook
  const { isOpen, activeTrailer, loadingMediaId, watchTrailer, closeTrailer } =
    useTrailer()

  // Merge movie and TV genres, removing duplicates by ID
  const mergedGenres = useMemo(() => {
    const genreMap = new Map<number, Genre>()
    ;[...movieGenres, ...tvGenres].forEach((genre) => {
      if (!genreMap.has(genre.id)) {
        genreMap.set(genre.id, genre)
      }
    })
    return Array.from(genreMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    )
  }, [movieGenres, tvGenres])

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

  // Filter items by all criteria
  const filteredItems = useMemo(() => {
    let items = listItems

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      items = items.filter((item) => {
        const title = (item.title || item.name || "").toLowerCase()
        return title.includes(query)
      })
    }

    // Media type filter
    if (filterState.mediaType !== "all") {
      items = items.filter((item) => item.media_type === filterState.mediaType)
    }

    // Genre filter
    if (filterState.genre !== "all") {
      const genreId = parseInt(filterState.genre)
      items = items.filter((item) => item.genre_ids?.includes(genreId))
    }

    // Year range filter
    items = items.filter((item) => {
      const dateStr = item.release_date || item.first_air_date
      if (!dateStr) return true // Include items without date
      const year = new Date(dateStr).getFullYear()
      return year >= yearRange[0] && year <= yearRange[1]
    })

    // Minimum rating filter
    if (minRating > 0) {
      items = items.filter((item) => (item.vote_average ?? 0) >= minRating)
    }

    return items
  }, [listItems, searchQuery, filterState, yearRange, minRating])

  // Sort items
  const sortedItems = useMemo(() => {
    const sorted = [...filteredItems].sort((a, b) => {
      let comparison = 0

      switch (sortState.field) {
        case "added":
          comparison = (a.addedAt || 0) - (b.addedAt || 0)
          break
        case "release_date": {
          const dateA = new Date(
            a.release_date || a.first_air_date || 0,
          ).getTime()
          const dateB = new Date(
            b.release_date || b.first_air_date || 0,
          ).getTime()
          comparison = dateA - dateB
          break
        }
        case "rating":
          comparison = (a.vote_average ?? 0) - (b.vote_average ?? 0)
          break
        case "title": {
          const titleA = (a.title || a.name || "").toLowerCase()
          const titleB = (b.title || b.name || "").toLowerCase()
          comparison = titleA.localeCompare(titleB)
          break
        }
      }

      return sortState.direction === "asc" ? comparison : -comparison
    })

    return sorted
  }, [filteredItems, sortState])

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

  // Handle filter change
  const handleFilterChange = useCallback((key: string, value: string) => {
    setFilterState((prev) => ({ ...prev, [key]: value }))
  }, [])

  // Handle clear all filters
  const handleClearAll = useCallback(() => {
    setFilterState({ mediaType: "all", genre: "all" })
    setYearRange([MIN_YEAR, CURRENT_YEAR])
    setMinRating(0)
    setSortState({ field: "added", direction: "desc" })
  }, [])

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
        {emptyStateAction}
      </Empty>
    )
  }

  const activeListIcon = activeList ? getListIcon(activeList) : defaultIcon
  const activeListName = activeList?.name ?? "Untitled"

  // Build filter categories
  const filterCategories = [
    {
      key: "mediaType",
      label: "Media Type",
      icon: Film01Icon,
      options: [
        { value: "all", label: "All" },
        { value: "movie", label: "Movies" },
        { value: "tv", label: "TV Shows" },
      ],
    },
    {
      key: "genre",
      label: "Genres",
      icon: Tv01Icon,
      options: [
        { value: "all", label: "All Genres" },
        ...mergedGenres.map((g) => ({ value: String(g.id), label: g.name })),
      ],
    },
  ]

  // Build sort fields
  const sortFields = [
    { value: "added", label: "Recently Added" },
    { value: "release_date", label: "Release Date" },
    { value: "rating", label: "Rating" },
    { value: "title", label: "Alphabetically" },
  ]

  return (
    <div className="space-y-8 pb-12">
      {/* Dynamic Header */}
      {showDynamicHeader && activeList && (
        <div className="flex items-center gap-4">
          <PageHeader title={activeList.name} className="mb-0" />
          {headerAction}
        </div>
      )}

      {/* Search, Filter, and Tabs */}
      <div className="space-y-6">
        {/* Search and Filter Row */}
        <div className="flex items-center gap-3">
          <SearchInput
            id="lists-search-input"
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search in this list..."
            className="flex-1"
          />
          <FilterSort
            filters={filterCategories}
            filterState={filterState}
            onFilterChange={handleFilterChange}
            sortFields={sortFields}
            sortState={sortState}
            onSortChange={setSortState}
            yearRange={{
              min: MIN_YEAR,
              max: CURRENT_YEAR,
              value: yearRange,
              onChange: setYearRange,
            }}
            ratingFilter={{
              value: minRating,
              onChange: setMinRating,
            }}
            onClearAll={handleClearAll}
          />
        </div>

        {/* List Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {lists.map((list) => (
            <FilterTabButton
              key={list.id}
              label={list.name}
              count={getItemCount(list)}
              isActive={activeListId === list.id}
              icon={getListIcon(list)}
              onClick={() => handleListSelect(list.id)}
            />
          ))}
        </div>
      </div>

      {/* Results */}
      {sortedItems.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7">
          {sortedItems.map((item) => (
            <MediaCardWithActions
              key={`${item.media_type}-${item.id}`}
              media={listItemToMedia(item)}
              onWatchTrailer={handleWatchTrailer}
              isLoading={loadingMediaId === `${item.media_type}-${item.id}`}
            />
          ))}
        </div>
      ) : listItems.length > 0 &&
        (searchQuery.trim() ||
          filterState.mediaType !== "all" ||
          filterState.genre !== "all" ||
          minRating > 0 ||
          yearRange[0] !== MIN_YEAR ||
          yearRange[1] !== CURRENT_YEAR) ? (
        <Empty className="py-20">
          <EmptyMedia variant="icon">
            <HugeiconsIcon icon={Search01Icon} className="size-6" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>No results found</EmptyTitle>
            <EmptyDescription>
              No items in &quot;{activeListName}&quot; match your filters
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
