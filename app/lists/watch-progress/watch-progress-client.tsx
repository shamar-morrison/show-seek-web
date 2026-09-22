"use client"

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { FilterSort, type SortState } from "@/components/ui/filter-sort"
import { FilterTabButton } from "@/components/ui/filter-tab-button"
import { SearchInput } from "@/components/ui/search-input"
import { Skeleton } from "@/components/ui/skeleton"
import { WatchProgressCard } from "@/components/watch-progress-card"
import { WatchProgressOptionsMenu } from "@/components/watch-progress-options-menu"
import { useAuth } from "@/context/auth-context"
import { useEpisodeTracking } from "@/hooks/use-episode-tracking"
import { useWatchProgressEnrichment } from "@/hooks/use-watch-progress-enrichment"
import {
  CheckmarkCircle02Icon,
  Loading03Icon,
  PlayCircle02Icon,
  Search01Icon,
  ViewOffSlashIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useCallback, useMemo, useState } from "react"

const SORT_FIELDS = [
  { value: "lastWatched", label: "Last Watched" },
  { value: "progress", label: "Progress" },
  { value: "alphabetical", label: "Alphabetically" },
] as const

const DEFAULT_SORT_STATE: SortState = {
  field: "lastWatched",
  direction: "desc",
}

const HIDE_COMPLETED_STORAGE_KEY = "watchProgressHideCompleted"

/**
 * Skeleton placeholder matching the WatchProgressCard layout.
 * Shown while enrichment data is loading.
 */
function WatchProgressCardSkeleton() {
  return (
    <div className="flex gap-4 rounded-xl bg-card p-4">
      {/* Poster */}
      <Skeleton className="aspect-2/3 w-16 shrink-0 rounded-lg sm:w-20" />
      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {/* Title */}
        <Skeleton className="h-5 w-3/4 rounded" />
        {/* Next episode */}
        <Skeleton className="h-4 w-1/2 rounded" />
        {/* Progress bar */}
        <div className="mt-auto flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <Skeleton className="h-1.5 flex-1 rounded-full" />
            <Skeleton className="h-3 w-8 rounded" />
          </div>
        </div>
      </div>
    </div>
  )
}

export type WatchProgressTab = "watching" | "caughtUp" | "hidden"

/**
 * WatchProgressClient Component
 * Client component for the watch progress page with search, tabs, and grid layout
 */
export function WatchProgressClient() {
  const { user, loading: authLoading } = useAuth()
  const {
    watchProgress,
    watchedEpisodesByShow,
    loading: trackingLoading,
  } = useEpisodeTracking()
  const { enrichedProgress, isEnriching } = useWatchProgressEnrichment(
    watchProgress,
    watchedEpisodesByShow,
  )
  const [activeTab, setActiveTab] = useState<WatchProgressTab>("watching")
  const [searchQuery, setSearchQuery] = useState("")
  const [sortState, setSortState] = useState<SortState>(DEFAULT_SORT_STATE)
  const [hideCompleted, setHideCompleted] = useState<boolean>(() => {
    if (typeof window === "undefined") return false
    try {
      return window.localStorage.getItem(HIDE_COMPLETED_STORAGE_KEY) === "true"
    } catch {
      return false
    }
  })

  const handleHideCompletedChange = useCallback((value: boolean) => {
    setHideCompleted(value)
    try {
      window.localStorage.setItem(
        HIDE_COMPLETED_STORAGE_KEY,
        JSON.stringify(value),
      )
    } catch (error) {
      console.error("Failed to save hide completed preference:", error)
    }
  }, [])

  // Split into watching vs caught up vs hidden shows matching mobile
  const watchingShows = useMemo(
    () =>
      enrichedProgress.filter(
        (p) => !p.isHidden && p.nextEpisode?.kind === "unwatched",
      ),
    [enrichedProgress],
  )

  const caughtUpShows = useMemo(
    () =>
      enrichedProgress.filter((p) => {
        if (p.isHidden) return false
        if (p.nextEpisode?.kind === "upcoming") return true
        if (p.nextEpisode?.kind === "complete") return !hideCompleted
        return false
      }),
    [enrichedProgress, hideCompleted],
  )

  const hiddenShows = useMemo(
    () => enrichedProgress.filter((p) => p.isHidden),
    [enrichedProgress],
  )

  const currentTabShows =
    activeTab === "watching"
      ? watchingShows
      : activeTab === "caughtUp"
        ? caughtUpShows
        : hiddenShows

  // Filter shows by search query
  const filteredProgress = useMemo(() => {
    if (!searchQuery.trim()) return currentTabShows
    const query = searchQuery.toLowerCase()
    return currentTabShows.filter((p) =>
      p.tvShowName.toLowerCase().includes(query),
    )
  }, [currentTabShows, searchQuery])

  const sortedProgress = useMemo(() => {
    const sorted = [...filteredProgress]

    sorted.sort((left, right) => {
      let comparison = 0

      switch (sortState.field) {
        case "progress":
          comparison = left.percentage - right.percentage
          break
        case "alphabetical":
          comparison = left.tvShowName.localeCompare(right.tvShowName)
          break
        case "lastWatched":
        default:
          comparison = left.lastUpdated - right.lastUpdated
          break
      }

      return sortState.direction === "asc" ? comparison : -comparison
    })

    return sorted
  }, [filteredProgress, sortState])

  const isLoading = authLoading || trackingLoading

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <HugeiconsIcon
          icon={Loading03Icon}
          className="size-8 animate-spin text-primary"
        />
      </div>
    )
  }

  // No progress state at all
  if (enrichedProgress.length === 0) {
    return (
      <Empty className="py-20">
        <EmptyMedia variant="icon">
          <HugeiconsIcon icon={PlayCircle02Icon} className="size-6" />
        </EmptyMedia>
        <EmptyHeader>
          <EmptyTitle>No watch progress yet</EmptyTitle>
          <EmptyDescription>
            Start marking episodes as watched from TV show detail pages.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Tabs */}
      <div className="flex items-center gap-2">
        <FilterTabButton
          label="Watching"
          count={watchingShows.length}
          isActive={activeTab === "watching"}
          icon={PlayCircle02Icon}
          onClick={() => setActiveTab("watching")}
          testId="watch-progress-watching-tab"
        />
        <FilterTabButton
          label="Caught Up"
          count={caughtUpShows.length}
          isActive={activeTab === "caughtUp"}
          icon={CheckmarkCircle02Icon}
          onClick={() => setActiveTab("caughtUp")}
          testId="watch-progress-caught-up-tab"
        />
        <FilterTabButton
          label="Hidden"
          count={hiddenShows.length}
          isActive={activeTab === "hidden"}
          icon={ViewOffSlashIcon}
          onClick={() => setActiveTab("hidden")}
          testId="watch-progress-hidden-tab"
        />
      </div>

      {/* Search & Sort */}
      <div className="flex items-center gap-3">
        <SearchInput
          id="watch-progress-search-input"
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search TV shows..."
          className="flex-1"
        />
        <FilterSort
          filters={[]}
          filterState={{}}
          onFilterChange={() => {}}
          sortFields={SORT_FIELDS.map((field) => ({ ...field }))}
          sortState={sortState}
          onSortChange={setSortState}
        />
        <WatchProgressOptionsMenu
          hideCompleted={hideCompleted}
          onHideCompletedChange={handleHideCompletedChange}
        />
      </div>

      {/* Results */}
      {isEnriching ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: enrichedProgress.length || 6 }, (_, i) => (
            <WatchProgressCardSkeleton key={i} />
          ))}
        </div>
      ) : sortedProgress.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sortedProgress.map((progress) => (
            <WatchProgressCard
              key={progress.tvShowId}
              progress={progress}
              isHiddenView={activeTab === "hidden"}
            />
          ))}
        </div>
      ) : currentTabShows.length === 0 ? (
        <Empty className="py-20">
          <EmptyMedia variant="icon">
            <HugeiconsIcon
              icon={
                activeTab === "watching"
                  ? PlayCircle02Icon
                  : activeTab === "caughtUp"
                    ? CheckmarkCircle02Icon
                    : ViewOffSlashIcon
              }
              className="size-6"
            />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>
              {activeTab === "watching"
                ? "No shows in progress"
                : activeTab === "caughtUp"
                  ? "No caught-up shows"
                  : "No hidden shows"}
            </EmptyTitle>
            <EmptyDescription>
              {activeTab === "watching"
                ? "All your tracked TV shows are either caught up or hidden."
                : activeTab === "caughtUp"
                  ? "Shows you're caught up on will appear here."
                  : "Shows you hide from watch progress will appear here."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Empty className="py-20">
          <EmptyMedia variant="icon">
            <HugeiconsIcon icon={Search01Icon} className="size-6" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>No results found</EmptyTitle>
            <EmptyDescription>
              No shows match &quot;{searchQuery}&quot;
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </div>
  )
}
