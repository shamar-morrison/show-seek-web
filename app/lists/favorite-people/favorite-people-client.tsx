"use client"

import { AuthModal } from "@/components/auth-modal"
import { FavoritePersonCard } from "@/components/favorite-person-card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { FilterSort, FilterState, SortState } from "@/components/ui/filter-sort"
import { SearchInput } from "@/components/ui/search-input"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/context/auth-context"
import { useFavoritePersons } from "@/hooks/use-favorite-persons"
import {
  Search01Icon,
  UserIcon,
  UserMultipleIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useCallback, useMemo, useState } from "react"

// Job/department filter options
const JOB_FILTER_OPTIONS = [
  { value: "0", label: "All Jobs" },
  { value: "Acting", label: "Actors" },
  { value: "Directing", label: "Directors" },
  { value: "Writing", label: "Writers" },
  { value: "Production", label: "Producers" },
  { value: "Camera", label: "Cinematographers" },
  { value: "Editing", label: "Editors" },
  { value: "Sound", label: "Sound" },
  { value: "Art", label: "Art Department" },
  { value: "Costume & Make-Up", label: "Costume & Make-Up" },
  { value: "Visual Effects", label: "Visual Effects" },
  { value: "Crew", label: "Crew" },
]

// Sort fields
const SORT_FIELDS = [
  { value: "addedAt", label: "Recently Added" },
  { value: "name", label: "Alphabetically" },
]

/**
 * Favorite People Client Component
 * Handles search filtering, job filtering, sorting, and displays favorite persons in a grid
 */
export function FavoritePeopleClient() {
  const { user, loading: authLoading } = useAuth()
  const { persons, count, loading, searchQuery, setSearchQuery, removePerson } =
    useFavoritePersons()

  // Filter state
  const [filterState, setFilterState] = useState<FilterState>({
    job: "0",
  })

  // Sort state
  const [sortState, setSortState] = useState<SortState>({
    field: "addedAt",
    direction: "desc",
  })

  // Filter and sort persons
  const filteredAndSortedPersons = useMemo(() => {
    // Apply job filter
    let filtered = persons
    if (filterState.job && filterState.job !== "0") {
      filtered = persons.filter(
        (person) => person.known_for_department === filterState.job,
      )
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0

      switch (sortState.field) {
        case "addedAt":
          comparison = (a.addedAt || 0) - (b.addedAt || 0)
          break
        case "name":
          comparison = (a.name || "")
            .toLowerCase()
            .localeCompare((b.name || "").toLowerCase())
          break
      }

      return sortState.direction === "asc" ? comparison : -comparison
    })

    return sorted
  }, [persons, filterState, sortState])

  // Handle filter change
  const handleFilterChange = useCallback((key: string, value: string) => {
    setFilterState((prev) => ({ ...prev, [key]: value }))
  }, [])

  // Handle clear all
  const handleClearAll = useCallback(() => {
    setFilterState({ job: "0" })
    setSortState({ field: "addedAt", direction: "desc" })
    setSearchQuery("")
  }, [setSearchQuery])

  // Check if filters are active
  const hasActiveFilters = searchQuery.trim() !== "" || filterState.job !== "0"

  // Show auth prompt if not logged in
  if (!authLoading && (!user || user.isAnonymous)) {
    return (
      <Empty className="border border-white/10">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <HugeiconsIcon icon={UserMultipleIcon} />
          </EmptyMedia>
          <EmptyTitle>Sign in to view your favorite people</EmptyTitle>
          <EmptyDescription>
            Add actors, directors, and creators to your favorites to see them
            here.
          </EmptyDescription>
        </EmptyHeader>
        <AuthModal />
      </Empty>
    )
  }

  // Loading state
  if (authLoading || loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-full max-w-md" />
        <FavoritePeopleGridSkeleton />
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Search and Filter Row */}
      <div className="flex items-center gap-3">
        <SearchInput
          id="favorite-people-search-input"
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search favorite people..."
          className="flex-1"
        />
        <FilterSort
          filters={[
            {
              key: "job",
              label: "Job",
              icon: UserIcon,
              options: JOB_FILTER_OPTIONS,
            },
          ]}
          filterState={filterState}
          onFilterChange={handleFilterChange}
          sortFields={SORT_FIELDS}
          sortState={sortState}
          onSortChange={setSortState}
          onClearAll={hasActiveFilters ? handleClearAll : undefined}
        />
      </div>

      {/* Count Display */}
      {count > 0 && (
        <p className="text-sm text-gray-400">
          {filteredAndSortedPersons.length === count
            ? `${count} favorite ${count === 1 ? "person" : "people"}`
            : `Showing ${filteredAndSortedPersons.length} of ${count}`}
        </p>
      )}

      {/* Content */}
      {count === 0 ? (
        // No favorites at all
        <Empty className="border border-white/10">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={UserMultipleIcon} />
            </EmptyMedia>
            <EmptyTitle>No favorite people yet</EmptyTitle>
            <EmptyDescription>
              Visit person detail pages to add them to your favorites.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : filteredAndSortedPersons.length === 0 ? (
        // No matches for filters/search
        <Empty className="border border-white/10">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={Search01Icon} />
            </EmptyMedia>
            <EmptyTitle>No results found</EmptyTitle>
            <EmptyDescription>
              {searchQuery
                ? `No people match "${searchQuery}"`
                : "No people match your current filters."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid grid-cols-2 gap-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7">
          {filteredAndSortedPersons.map((person, index) => (
            <FavoritePersonCard
              key={person.id}
              person={person}
              onRemove={removePerson}
              priority={index < 7}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/** Skeleton loading state for favorite people grid */
function FavoritePeopleGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-xl bg-card">
          <Skeleton className="aspect-2/3 w-full" />
          <div className="space-y-2 p-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}
