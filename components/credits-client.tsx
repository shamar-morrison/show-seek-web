"use client"

import { CastCard } from "@/components/cast-card"
import { CrewCard } from "@/components/crew-card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { FilterTabButton } from "@/components/ui/filter-tab-button"
import { SearchInput } from "@/components/ui/search-input"
import { Skeleton } from "@/components/ui/skeleton"
import type { CastMember, CrewMember } from "@/types/tmdb"
import {
  Search01Icon,
  UserGroupIcon,
  UserIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import Link from "next/link"
import { useMemo, useState } from "react"

type TabType = "cast" | "crew"

interface CreditsClientProps {
  /** Title of the media (movie or TV show name) */
  title: string
  /** Media type for back link */
  mediaType: "movie" | "tv"
  /** Media ID for back link */
  mediaId: number
  /** Cast members */
  cast: CastMember[]
  /** Crew members */
  crew: CrewMember[]
}

/**
 * CreditsClient Component
 * Displays full cast and crew with tabbed navigation and search filtering
 * Matches the UX patterns of watch list screens
 */
export function CreditsClient({
  title,
  mediaType,
  mediaId,
  cast,
  crew,
}: CreditsClientProps) {
  const [activeTab, setActiveTab] = useState<TabType>("cast")
  const [searchQuery, setSearchQuery] = useState("")

  // Filter cast/crew based on search query
  const filteredCast = useMemo(() => {
    if (!searchQuery.trim()) return cast

    const query = searchQuery.toLowerCase()
    return cast.filter(
      (member) =>
        member.name.toLowerCase().includes(query) ||
        member.character?.toLowerCase().includes(query),
    )
  }, [cast, searchQuery])

  const filteredCrew = useMemo(() => {
    if (!searchQuery.trim()) return crew

    const query = searchQuery.toLowerCase()
    return crew.filter(
      (member) =>
        member.name.toLowerCase().includes(query) ||
        member.job?.toLowerCase().includes(query) ||
        member.department?.toLowerCase().includes(query),
    )
  }, [crew, searchQuery])

  // Deduplicate crew by id + job to avoid showing same person multiple times for same role
  const deduplicatedCrew = useMemo(() => {
    const seen = new Set<string>()
    return filteredCrew.filter((member) => {
      const key = `${member.id}-${member.job}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [filteredCrew])

  const currentItems = activeTab === "cast" ? filteredCast : deduplicatedCrew
  const totalCount = activeTab === "cast" ? cast.length : crew.length
  const filteredCount =
    activeTab === "cast" ? filteredCast.length : deduplicatedCrew.length

  return (
    <div className="space-y-6 pb-12">
      {/* Back Link */}
      <Link
        href={`/${mediaType}/${mediaId}`}
        className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
      >
        ← Back to {title}
      </Link>

      {/* Page Title */}
      <h1 className="text-3xl font-bold text-white">Cast & Crew</h1>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-white/10 pb-4">
        <FilterTabButton
          label="Cast"
          count={cast.length}
          isActive={activeTab === "cast"}
          icon={UserIcon}
          onClick={() => setActiveTab("cast")}
        />
        <FilterTabButton
          label="Crew"
          count={crew.length}
          isActive={activeTab === "crew"}
          icon={UserGroupIcon}
          onClick={() => setActiveTab("crew")}
        />
      </div>

      {/* Search Input */}
      <SearchInput
        id="credits-search-input"
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder={
          activeTab === "cast"
            ? "Search by name or character..."
            : "Search by name, job, or department..."
        }
        className="w-full"
      />

      {/* Count Display */}
      {totalCount > 0 && (
        <p className="text-sm text-gray-400">
          {filteredCount === totalCount
            ? `${totalCount} ${activeTab === "cast" ? (totalCount === 1 ? "cast member" : "cast members") : totalCount === 1 ? "crew member" : "crew members"}`
            : `Showing ${filteredCount} of ${totalCount}`}
        </p>
      )}

      {/* Content Grid */}
      {totalCount === 0 ? (
        // No cast/crew at all
        <Empty className="border border-white/10">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon
                icon={activeTab === "cast" ? UserIcon : UserGroupIcon}
              />
            </EmptyMedia>
            <EmptyTitle>
              No {activeTab === "cast" ? "cast" : "crew"} information available
            </EmptyTitle>
            <EmptyDescription>
              We don't have {activeTab === "cast" ? "cast" : "crew"} data for
              this title yet.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : filteredCount === 0 ? (
        // No matches for search
        <Empty className="border border-white/10">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={Search01Icon} />
            </EmptyMedia>
            <EmptyTitle>No results found</EmptyTitle>
            <EmptyDescription>
              No {activeTab === "cast" ? "cast" : "crew"} members match "
              {searchQuery}"
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid grid-cols-2 gap-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7">
          {activeTab === "cast"
            ? filteredCast.map((member, index) => (
                <CastCard
                  key={`${member.id}-${member.character || member.order || index}`}
                  cast={member}
                  priority={index < 7}
                  fullWidth
                />
              ))
            : deduplicatedCrew.map((member, index) => (
                <CrewCard
                  key={`${member.id}-${member.job}-${index}`}
                  crew={member}
                  priority={index < 7}
                />
              ))}
        </div>
      )}
    </div>
  )
}

/** Skeleton loading state for credits grid */
export function CreditsGridSkeleton() {
  return (
    <div className="space-y-6 pb-12">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-10 w-64" />
      <div className="flex gap-2">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-24" />
      </div>
      <Skeleton className="h-12 w-full max-w-2xl" />
      <Skeleton className="h-4 w-40" />
      <div className="grid grid-cols-2 gap-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7">
        {Array.from({ length: 14 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-xl bg-card">
            <Skeleton className="aspect-2/3 w-full" />
            <div className="space-y-2 p-3">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
