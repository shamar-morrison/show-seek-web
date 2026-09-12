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
import { WatchProgressCard } from "@/components/watch-progress-card"
import { useAuth } from "@/context/auth-context"
import { useEpisodeTracking } from "@/hooks/use-episode-tracking"
import { useWatchProgressEnrichment } from "@/hooks/use-watch-progress-enrichment"
import {
  Loading03Icon,
  PlayCircle02Icon,
  Search01Icon,
  ViewOffSlashIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useMemo, useState } from "react"

const SORT_FIELDS = [
  { value: "lastWatched", label: "Last Watched" },
  { value: "progress", label: "Progress" },
  { value: "alphabetical", label: "Alphabetically" },
] as const

const DEFAULT_SORT_STATE: SortState = {
  field: "lastWatched",
  direction: "desc",
}

type WatchProgressTab = "active" | "hidden"

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
  const [activeTab, setActiveTab] = useState<WatchProgressTab>("active")
  const [searchQuery, setSearchQuery] = useState("")
  const [sortState, setSortState] = useState<SortState>(DEFAULT_SORT_STATE)

  // Split into active (not hidden and not completed) and hidden shows
  const activeShows = useMemo(
    () => enrichedProgress.filter((p) => !p.isHidden && p.percentage < 100),
    [enrichedProgress],
  )

  const hiddenShows = useMemo(
    () => enrichedProgress.filter((p) => p.isHidden),
    [enrichedProgress],
  )

  const currentTabShows = activeTab === "active" ? activeShows : hiddenShows

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
          count={activeShows.length}
          isActive={activeTab === "active"}
          icon={PlayCircle02Icon}
          onClick={() => setActiveTab("active")}
          testId="watch-progress-active-tab"
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

      {/* Search Input with Enrichment Indicator */}
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
        {isEnriching && (
          <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
            <HugeiconsIcon
              icon={Loading03Icon}
              className="size-4 animate-spin"
            />
            <span className="hidden sm:inline">Refreshing...</span>
          </div>
        )}
      </div>

      {/* Results */}
      {sortedProgress.length > 0 ? (
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
              icon={activeTab === "active" ? PlayCircle02Icon : ViewOffSlashIcon}
              className="size-6"
            />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>
              {activeTab === "active" ? "No shows in progress" : "No hidden shows"}
            </EmptyTitle>
            <EmptyDescription>
              {activeTab === "active"
                ? "All your tracked TV shows are either completed or hidden."
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
