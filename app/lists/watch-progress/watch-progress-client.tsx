"use client"

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { SearchInput } from "@/components/ui/search-input"
import { WatchProgressCard } from "@/components/watch-progress-card"
import { useAuth } from "@/context/auth-context"
import { useEpisodeTracking } from "@/hooks/use-episode-tracking"
import { useWatchProgressEnrichment } from "@/hooks/use-watch-progress-enrichment"
import {
  Loading03Icon,
  PlayCircle02Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useMemo, useState } from "react"

/**
 * WatchProgressClient Component
 * Client component for the watch progress page with search and grid layout
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
  const [searchQuery, setSearchQuery] = useState("")

  // Filter progress by search query
  const filteredProgress = useMemo(() => {
    if (!searchQuery.trim()) return enrichedProgress
    const query = searchQuery.toLowerCase()
    return enrichedProgress.filter((p) =>
      p.tvShowName.toLowerCase().includes(query),
    )
  }, [enrichedProgress, searchQuery])

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

  // No progress state
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
    <div className="space-y-8 pb-12">
      {/* Search Input with Enrichment Indicator */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <SearchInput
            id="watch-progress-search-input"
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search TV shows..."
          />
        </div>
        {isEnriching && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <HugeiconsIcon
              icon={Loading03Icon}
              className="size-4 animate-spin"
            />
            <span className="hidden sm:inline">Refreshing...</span>
          </div>
        )}
      </div>

      {/* Results */}
      {filteredProgress.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredProgress.map((progress) => (
            <WatchProgressCard key={progress.tvShowId} progress={progress} />
          ))}
        </div>
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
