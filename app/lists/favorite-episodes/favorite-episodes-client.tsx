"use client"

import { AuthModal } from "@/components/auth-modal"
import { FavoriteEpisodeCard } from "@/components/favorite-episode-card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { FilterSort, type SortState } from "@/components/ui/filter-sort"
import { SearchInput } from "@/components/ui/search-input"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/context/auth-context"
import { useFavoriteEpisodes } from "@/hooks/use-favorite-episodes"
import {
  FavouriteIcon,
  Search01Icon,
  Tv01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useCallback, useMemo, useState } from "react"

const SORT_FIELDS = [
  { value: "addedAt", label: "Recently Added" },
  { value: "showName", label: "Show Title" },
  { value: "episodeName", label: "Episode Title" },
]

const DEFAULT_SORT_STATE: SortState = {
  field: "addedAt",
  direction: "desc",
}

export function FavoriteEpisodesClient() {
  const { user, loading: authLoading } = useAuth()
  const { episodes, count, loading } = useFavoriteEpisodes()
  const [searchQuery, setSearchQuery] = useState("")
  const [sortState, setSortState] = useState<SortState>(DEFAULT_SORT_STATE)

  const filteredEpisodes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return episodes

    return episodes.filter((episode) =>
      `${episode.showName} ${episode.episodeName}`
        .toLowerCase()
        .includes(query),
    )
  }, [episodes, searchQuery])

  const sortedEpisodes = useMemo(() => {
    const sorted = [...filteredEpisodes]

    sorted.sort((left, right) => {
      const showComparison = left.showName
        .toLowerCase()
        .localeCompare(right.showName.toLowerCase())
      const episodeComparison = left.episodeName
        .toLowerCase()
        .localeCompare(right.episodeName.toLowerCase())
      const seasonComparison = left.seasonNumber - right.seasonNumber
      const numberComparison = left.episodeNumber - right.episodeNumber

      let comparison = 0

      switch (sortState.field) {
        case "showName":
          comparison =
            showComparison ||
            episodeComparison ||
            seasonComparison ||
            numberComparison
          break
        case "episodeName":
          comparison =
            episodeComparison ||
            showComparison ||
            seasonComparison ||
            numberComparison
          break
        case "addedAt":
        default:
          comparison =
            left.addedAt - right.addedAt ||
            showComparison ||
            seasonComparison ||
            numberComparison
          break
      }

      return sortState.direction === "asc" ? comparison : -comparison
    })

    return sorted
  }, [filteredEpisodes, sortState])

  const hasActiveControls =
    searchQuery.trim().length > 0 ||
    sortState.field !== DEFAULT_SORT_STATE.field ||
    sortState.direction !== DEFAULT_SORT_STATE.direction

  const handleClearAll = useCallback(() => {
    setSearchQuery("")
    setSortState(DEFAULT_SORT_STATE)
  }, [])

  if (!authLoading && (!user || user.isAnonymous)) {
    return (
      <Empty className="border border-white/10">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <HugeiconsIcon icon={FavouriteIcon} />
          </EmptyMedia>
          <EmptyTitle>Sign in to view your favorite episodes</EmptyTitle>
          <EmptyDescription>
            Add episodes to your favorites from episode detail pages to see them
            here.
          </EmptyDescription>
        </EmptyHeader>
        <AuthModal />
      </Empty>
    )
  }

  if (authLoading || loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-full max-w-md" />
        <FavoriteEpisodesGridSkeleton />
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center gap-3">
        <SearchInput
          id="favorite-episodes-search-input"
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search favorite episodes..."
          aria-label="Search favorite episodes"
          className="flex-1"
        />
        <FilterSort
          filters={[]}
          filterState={{}}
          onFilterChange={() => {}}
          sortFields={SORT_FIELDS}
          sortState={sortState}
          onSortChange={setSortState}
          onClearAll={hasActiveControls ? handleClearAll : undefined}
          showClearAll={hasActiveControls}
        />
      </div>

      {count > 0 && (
        <p className="text-sm text-gray-400">
          {sortedEpisodes.length === count
            ? `${count} favorite ${count === 1 ? "episode" : "episodes"}`
            : `Showing ${sortedEpisodes.length} of ${count}`}
        </p>
      )}

      {count === 0 ? (
        <Empty className="border border-white/10">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={Tv01Icon} />
            </EmptyMedia>
            <EmptyTitle>No favorite episodes yet</EmptyTitle>
            <EmptyDescription>
              Visit episode detail pages to add episodes to your favorites.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : sortedEpisodes.length === 0 ? (
        <Empty className="border border-white/10">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={Search01Icon} />
            </EmptyMedia>
            <EmptyTitle>No results found</EmptyTitle>
            <EmptyDescription>
              No favorite episodes match &quot;{searchQuery}&quot;.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sortedEpisodes.map((episode) => (
            <FavoriteEpisodeCard key={episode.id} episode={episode} />
          ))}
        </div>
      )}
    </div>
  )
}

function FavoriteEpisodesGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-2xl border border-white/5 bg-card"
        >
          <Skeleton className="aspect-[16/10] w-full" />
          <div className="space-y-3 p-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      ))}
    </div>
  )
}
