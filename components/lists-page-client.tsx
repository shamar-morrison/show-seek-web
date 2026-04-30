"use client"

import { AddToListModal } from "@/components/add-to-list-modal"
import { MediaCardWithActions } from "@/components/media-card-with-actions"
import { PageHeader } from "@/components/page-header"
import { ShuffleDialog } from "@/components/shuffle-dialog"
import { TrailerModal } from "@/components/trailer-modal"
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { useBulkListOperations } from "@/hooks/use-bulk-list-operations"
import { usePreferences } from "@/hooks/use-preferences"
import { useTrailer } from "@/hooks/use-trailer"
import { listItemToMedia } from "@/lib/list-media"
import { getDisplayMediaTitle } from "@/lib/media-title"
import { compareTmdbDateStrings, getTmdbDateYear } from "@/lib/tmdb-date"
import type { ListMediaItem, UserList } from "@/types/list"
import type { Genre, TMDBActionableMedia } from "@/types/tmdb"
import {
  Bookmark02Icon,
  Cancel01Icon,
  FavouriteIcon,
  Film01Icon,
  FolderLibraryIcon,
  Loading03Icon,
  PlayCircle02Icon,
  Search01Icon,
  ShuffleIcon,
  Tick02Icon,
  Tv01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

/** Map list IDs to icons for default lists */
export const DEFAULT_LIST_ICONS: Record<string, typeof Bookmark02Icon> = {
  watchlist: Bookmark02Icon,
  "currently-watching": PlayCircle02Icon,
  "already-watched": Tick02Icon,
  favorites: FavouriteIcon,
  dropped: Cancel01Icon,
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
  /** Optional action element or render callback to place beside the filter controls */
  filterRowAction?:
    | React.ReactNode
    | ((args: {
        activeList: UserList | undefined
        canSelectItems: boolean
        enterSelectionMode: () => void
        isSelectionMode: boolean
      }) => React.ReactNode)
  /** Optional action element to render in the empty state */
  emptyStateAction?: React.ReactNode
  /** Whether to show the shuffle action for the active filtered list */
  showShuffleAction?: boolean
  /** Whether to show the built-in standalone Select button */
  showDefaultSelectAction?: boolean
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
  filterRowAction,
  emptyStateAction,
  showShuffleAction = false,
  showDefaultSelectAction = true,
}: ListsPageClientProps) {
  const { preferences } = usePreferences()
  const { removeItemsFromListBatch } = useBulkListOperations()
  const [internalSelectedListId, setInternalSelectedListId] =
    useState<string>("")
  const [searchQuery, setSearchQuery] = useState("")
  const [shuffleDialogOpen, setShuffleDialogOpen] = useState(false)
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [selectedItems, setSelectedItems] = useState<
    Record<string, ListMediaItem>
  >({})
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false)
  const [isRemoveConfirmOpen, setIsRemoveConfirmOpen] = useState(false)
  const [isBulkRemoving, setIsBulkRemoving] = useState(false)
  const [bulkRemoveProgress, setBulkRemoveProgress] = useState<{
    processed: number
    total: number
  } | null>(null)

  // Use controlled state if provided, otherwise fall back to internal selection
  const selectedListId = useMemo(() => {
    if (controlledSelectedListId !== undefined) {
      return controlledSelectedListId
    }

    if (
      internalSelectedListId &&
      lists.some((list) => list.id === internalSelectedListId)
    ) {
      return internalSelectedListId
    }

    return lists[0]?.id ?? ""
  }, [controlledSelectedListId, internalSelectedListId, lists])

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

  const getSelectionKey = useCallback(
    (item: Pick<ListMediaItem, "id" | "media_type">) =>
      `${item.media_type}-${item.id}`,
    [],
  )

  const getItemDisplayTitle = useCallback(
    (item: ListMediaItem) =>
      getDisplayMediaTitle(
        listItemToMedia(item),
        preferences.showOriginalTitles,
      ) ||
      item.title ||
      item.name ||
      "",
    [preferences.showOriginalTitles],
  )

  // Filter items by all criteria
  const filteredItems = useMemo(() => {
    let items = listItems

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      items = items.filter((item) => {
        const title = getItemDisplayTitle(item).toLowerCase()
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
      const year = getTmdbDateYear(dateStr)
      return year >= yearRange[0] && year <= yearRange[1]
    })

    // Minimum rating filter
    if (minRating > 0) {
      items = items.filter((item) => (item.vote_average ?? 0) >= minRating)
    }

    return items
  }, [
    filterState,
    getItemDisplayTitle,
    listItems,
    minRating,
    searchQuery,
    yearRange,
  ])

  // Sort items
  const sortedItems = useMemo(() => {
    const sorted = [...filteredItems].sort((a, b) => {
      let comparison = 0

      switch (sortState.field) {
        case "added":
          comparison = (a.addedAt || 0) - (b.addedAt || 0)
          break
        case "release_date": {
          comparison = compareTmdbDateStrings(
            a.release_date || a.first_air_date,
            b.release_date || b.first_air_date,
          )
          break
        }
        case "rating":
          comparison = (a.vote_average ?? 0) - (b.vote_average ?? 0)
          break
        case "title": {
          const titleA = getItemDisplayTitle(a).toLowerCase()
          const titleB = getItemDisplayTitle(b).toLowerCase()
          comparison = titleA.localeCompare(titleB)
          break
        }
      }

      return sortState.direction === "asc" ? comparison : -comparison
    })

    return sorted
  }, [filteredItems, getItemDisplayTitle, sortState])

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
    (media: TMDBActionableMedia) => {
      watchTrailer(
        media.id,
        media.media_type,
        getDisplayMediaTitle(media, preferences.showOriginalTitles) ||
          "Trailer",
      )
    },
    [preferences.showOriginalTitles, watchTrailer],
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

  const canShuffle = sortedItems.length >= 2
  const canSelectItems = listItems.length > 0

  const selectedMediaItems = useMemo(
    () => Object.values(selectedItems),
    [selectedItems],
  )
  const selectedCount = selectedMediaItems.length

  useEffect(() => {
    if (!isSelectionMode) {
      return
    }

    const activeKeys = new Set(listItems.map(getSelectionKey))

    setSelectedItems((prev) =>
      Object.fromEntries(
        Object.entries(prev).filter(([key]) => activeKeys.has(key)),
      ),
    )
  }, [getSelectionKey, isSelectionMode, listItems])

  const enterSelectionMode = useCallback(() => {
    setSearchQuery("")
    setFilterState({ mediaType: "all", genre: "all" })
    setYearRange([MIN_YEAR, CURRENT_YEAR])
    setMinRating(0)
    setSelectedItems({})
    setIsSelectionMode(true)
  }, [])

  const exitSelectionMode = useCallback(() => {
    setIsSelectionMode(false)
    setSelectedItems({})
    setIsBulkModalOpen(false)
    setIsRemoveConfirmOpen(false)
    setBulkRemoveProgress(null)
  }, [])

  const toggleSelection = useCallback(
    (item: ListMediaItem) => {
      const itemKey = getSelectionKey(item)

      setSelectedItems((prev) => {
        const next = { ...prev }

        if (next[itemKey]) {
          delete next[itemKey]
        } else {
          next[itemKey] = item
        }

        return next
      })
    },
    [getSelectionKey],
  )

  const isItemSelected = useCallback(
    (item: ListMediaItem) => Boolean(selectedItems[getSelectionKey(item)]),
    [getSelectionKey, selectedItems],
  )

  const handleConfirmRemoveSelected = useCallback(async () => {
    if (!activeList || selectedMediaItems.length === 0) {
      return
    }

    setIsRemoveConfirmOpen(false)
    setIsBulkRemoving(true)
    setBulkRemoveProgress({
      processed: 0,
      total: selectedMediaItems.length,
    })

    try {
      const { failedItems, total } = await removeItemsFromListBatch({
        listId: activeList.id,
        mediaItems: selectedMediaItems,
        onProgress: (processed, nextTotal) => {
          setBulkRemoveProgress({ processed, total: nextTotal })
        },
      })

      if (failedItems.length === 0) {
        toast.success(
          `${total} item${total === 1 ? "" : "s"} removed from ${
            activeList.name
          }.`,
        )
        exitSelectionMode()
        return
      }

      setSelectedItems((prev) =>
        Object.fromEntries(
          Object.entries(prev).filter(([key]) => failedItems.includes(key)),
        ),
      )
      toast.error(
        `Failed to remove ${failedItems.length} of ${total} selected item${
          total === 1 ? "" : "s"
        }.`,
      )
    } catch (error) {
      console.error("Failed to remove selected items:", error)
      toast.error("Failed to remove selected items. Please try again.")
    } finally {
      setIsBulkRemoving(false)
      setBulkRemoveProgress(null)
    }
  }, [
    activeList,
    exitSelectionMode,
    removeItemsFromListBatch,
    selectedMediaItems,
  ])

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

  const resolvedFilterRowAction =
    typeof filterRowAction === "function"
      ? filterRowAction({
          activeList,
          canSelectItems,
          enterSelectionMode,
          isSelectionMode,
        })
      : filterRowAction

  return (
    <div className="space-y-8 pb-12">
      {/* Dynamic Header */}
      {showDynamicHeader && activeList && (
        <PageHeader
          title={activeList.name}
          description={activeList.description?.trim() || undefined}
          className="mb-4"
        />
      )}

      {/* Search, Filter, and Tabs */}
      <div className="space-y-6">
        {/* Search and Filter Row */}
        {isSelectionMode ? (
          <div className="rounded-xl border border-primary/20 bg-primary/8 px-4 py-3 text-sm text-white/80">
            Select items from &quot;{activeListName}&quot; to move, copy, or
            remove them in bulk.
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <SearchInput
              id="lists-search-input"
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search in this list..."
              className="min-w-[240px] flex-1"
            />
            {showShuffleAction ? (
              <Button
                variant="outline"
                size="lg"
                aria-label="Shuffle Pick"
                onClick={() => setShuffleDialogOpen(true)}
                disabled={!canShuffle}
              >
                <HugeiconsIcon icon={ShuffleIcon} className="size-4" />
              </Button>
            ) : null}
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

            {resolvedFilterRowAction}

            {showDefaultSelectAction && canSelectItems ? (
              <Button variant="outline" size="lg" onClick={enterSelectionMode}>
                Select
              </Button>
            ) : null}
          </div>
        )}

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
              disabled={isSelectionMode}
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
              selectionMode={isSelectionMode}
              isSelected={isItemSelected(item)}
              onSelectToggle={() => toggleSelection(item)}
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

      <ShuffleDialog
        isOpen={shuffleDialogOpen}
        onClose={() => setShuffleDialogOpen(false)}
        items={sortedItems}
      />

      {activeList ? (
        <AddToListModal
          isOpen={isBulkModalOpen}
          onClose={() => setIsBulkModalOpen(false)}
          mediaItems={selectedMediaItems}
          sourceListId={activeList.id}
          bulkAddMode={preferences.copyInsteadOfMove ? "copy" : "move"}
          onComplete={exitSelectionMode}
        />
      ) : null}

      <AlertDialog
        open={isRemoveConfirmOpen}
        onOpenChange={setIsRemoveConfirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove selected items?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove {selectedCount} selected item
              {selectedCount === 1 ? "" : "s"} from &quot;{activeListName}
              &quot;?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkRemoving}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                void handleConfirmRemoveSelected()
              }}
              disabled={isBulkRemoving || selectedCount === 0}
              className="bg-red-600 hover:bg-red-700"
            >
              Remove items
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isBulkRemoving}>
        <DialogContent showCloseButton={false} className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Removing items</DialogTitle>
            <DialogDescription>
              {bulkRemoveProgress
                ? `Processed ${bulkRemoveProgress.processed} of ${bulkRemoveProgress.total} selected items.`
                : "Removing selected items from this list."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
            <HugeiconsIcon
              icon={Loading03Icon}
              className="size-4 animate-spin text-primary"
            />
            Please keep this window open until the batch finishes.
          </div>
        </DialogContent>
      </Dialog>

      {isSelectionMode ? (
        <div className="sticky bottom-4 z-20 mt-6">
          <div className="mx-auto flex max-w-3xl flex-col gap-3 rounded-2xl border border-white/10 bg-black/85 p-4 shadow-2xl backdrop-blur-xl">
            <div className="text-sm font-medium text-white/80">
              {selectedCount} item{selectedCount === 1 ? "" : "s"} selected
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                className="flex-1"
                onClick={exitSelectionMode}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={() => setIsBulkModalOpen(true)}
                disabled={selectedCount === 0}
              >
                {preferences.copyInsteadOfMove
                  ? "Copy to lists"
                  : "Move to lists"}
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => setIsRemoveConfirmOpen(true)}
                disabled={selectedCount === 0}
              >
                Remove items
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
