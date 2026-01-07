"use client"

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { WatchProgressCard } from "@/components/watch-progress-card"
import { useAuth } from "@/context/auth-context"
import { useEpisodeTracking } from "@/hooks/use-episode-tracking"
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
  const { watchProgress, loading: trackingLoading } = useEpisodeTracking()
  const [searchQuery, setSearchQuery] = useState("")

  // Filter progress by search query
  const filteredProgress = useMemo(() => {
    if (!searchQuery.trim()) return watchProgress
    const query = searchQuery.toLowerCase()
    return watchProgress.filter((p) =>
      p.tvShowName.toLowerCase().includes(query),
    )
  }, [watchProgress, searchQuery])

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

  // Not logged in state
  if (!user) {
    return (
      <Empty className="py-20">
        <EmptyMedia variant="icon">
          <HugeiconsIcon icon={PlayCircle02Icon} className="size-6" />
        </EmptyMedia>
        <EmptyHeader>
          <EmptyTitle>Sign in to track progress</EmptyTitle>
          <EmptyDescription>
            Track your watch progress across all your TV shows.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  // No progress state
  if (watchProgress.length === 0) {
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
      {/* Search Input */}
      <div className="relative max-w-2xl">
        <HugeiconsIcon
          icon={Search01Icon}
          className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-gray-400"
        />
        <Input
          type="text"
          placeholder="Search TV shows..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-12 rounded-xl border-white/10 bg-white/5 pl-12 pr-4 text-lg text-white placeholder:text-gray-500 focus:border-primary/50 focus:ring-primary/20"
        />
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
