"use client"

import { CollectionProgressCard } from "@/components/collection-progress-card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { FilterSort, type SortState } from "@/components/ui/filter-sort"
import { SearchInput } from "@/components/ui/search-input"
import { useCollectionProgressList } from "@/hooks/use-collection-tracking"
import { type CollectionProgressItem } from "@/types/collection-tracking"
import {
  FolderLibraryIcon,
  Loading03Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useMemo, useState } from "react"

const SORT_FIELDS = [
  { value: "lastUpdated", label: "Last Updated" },
  { value: "progress", label: "Progress" },
  { value: "name", label: "Alphabetically" },
]

export function CollectionProgressClient() {
  const { progressItems, isLoading, isEmpty } = useCollectionProgressList()
  const [searchQuery, setSearchQuery] = useState("")
  const [sortState, setSortState] = useState<SortState>({
    field: "lastUpdated",
    direction: "desc",
  })

  const filteredCollections = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()

    if (!normalizedQuery) {
      return progressItems
    }

    return progressItems.filter((collection) =>
      collection.name.toLowerCase().includes(normalizedQuery),
    )
  }, [progressItems, searchQuery])

  const sortedCollections = useMemo(() => {
    const sorted = [...filteredCollections]

    sorted.sort((left, right) => {
      let comparison = 0

      switch (sortState.field) {
        case "progress":
          comparison = left.percentage - right.percentage
          break
        case "name":
          comparison = left.name.localeCompare(right.name)
          break
        case "lastUpdated":
        default:
          comparison = left.lastUpdated - right.lastUpdated
          break
      }

      return sortState.direction === "asc" ? comparison : -comparison
    })

    return sorted
  }, [filteredCollections, sortState])

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

  if (isEmpty) {
    return (
      <Empty className="py-20">
        <EmptyMedia variant="icon">
          <HugeiconsIcon icon={FolderLibraryIcon} className="size-6" />
        </EmptyMedia>
        <EmptyHeader>
          <EmptyTitle>No collections tracked</EmptyTitle>
          <EmptyDescription>
            Start tracking a collection from a movie collection page to see your
            progress here.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center gap-3">
        <SearchInput
          id="collection-progress-search-input"
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search collections..."
          className="flex-1"
        />
        <FilterSort
          filters={[]}
          filterState={{}}
          onFilterChange={() => {}}
          sortFields={SORT_FIELDS}
          sortState={sortState}
          onSortChange={setSortState}
        />
      </div>

      {sortedCollections.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sortedCollections.map((collection: CollectionProgressItem) => (
            <CollectionProgressCard
              key={collection.collectionId}
              collection={collection}
            />
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
              No collections match &quot;{searchQuery}&quot;
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </div>
  )
}
