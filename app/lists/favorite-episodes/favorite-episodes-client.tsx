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
import { useMemo, useState } from "react"

export function FavoriteEpisodesClient() {
  const { user, loading: authLoading } = useAuth()
  const { episodes, count, loading } = useFavoriteEpisodes()
  const [searchQuery, setSearchQuery] = useState("")

  const filteredEpisodes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return episodes

    return episodes.filter((episode) =>
      `${episode.showName} ${episode.episodeName}`
        .toLowerCase()
        .includes(query),
    )
  }, [episodes, searchQuery])

  if (!authLoading && (!user || user.isAnonymous)) {
    return (
      <Empty className="border border-white/10">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <HugeiconsIcon icon={FavouriteIcon} />
          </EmptyMedia>
          <EmptyTitle>Sign in to view your favorite episodes</EmptyTitle>
          <EmptyDescription>
            Add episodes to your favorites from episode detail pages to see
            them here.
          </EmptyDescription>
        </EmptyHeader>
        <AuthModal />
      </Empty>
    )
  }

  if (authLoading || loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full max-w-md" />
        <FavoriteEpisodesListSkeleton />
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-12">
      <SearchInput
        id="favorite-episodes-search-input"
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search favorite episodes..."
        aria-label="Search favorite episodes"
        className="max-w-md"
      />

      {count > 0 && (
        <p className="text-sm text-gray-400">
          {filteredEpisodes.length === count
            ? `${count} favorite ${count === 1 ? "episode" : "episodes"}`
            : `Showing ${filteredEpisodes.length} of ${count}`}
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
      ) : filteredEpisodes.length === 0 ? (
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
        <div className="space-y-4">
          {filteredEpisodes.map((episode) => (
            <FavoriteEpisodeCard key={episode.id} episode={episode} />
          ))}
        </div>
      )}
    </div>
  )
}

function FavoriteEpisodesListSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="flex gap-4 rounded-xl bg-card p-4">
          <Skeleton className="aspect-[2/3] w-16 rounded-lg sm:w-20" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-28" />
          </div>
        </div>
      ))}
    </div>
  )
}
