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
import { SearchInput } from "@/components/ui/search-input"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/context/auth-context"
import { useFavoritePersons } from "@/hooks/use-favorite-persons"
import { UserMultipleIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

/**
 * Favorite People Client Component
 * Handles search filtering and displays favorite persons in a grid
 */
export function FavoritePeopleClient() {
  const { user, loading: authLoading } = useAuth()
  const { persons, count, loading, searchQuery, setSearchQuery, removePerson } =
    useFavoritePersons()

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
      {/* Search Bar */}
      <SearchInput
        id="favorite-people-search-input"
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search favorite people..."
      />

      {/* Count Display */}
      {count > 0 && (
        <p className="text-sm text-gray-400">
          {persons.length === count
            ? `${count} favorite ${count === 1 ? "person" : "people"}`
            : `Showing ${persons.length} of ${count}`}
        </p>
      )}

      {/* Content */}
      {persons.length === 0 ? (
        <Empty className="border border-white/10">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={UserMultipleIcon} />
            </EmptyMedia>
            <EmptyTitle>
              {searchQuery ? "No matching people" : "No favorite people yet"}
            </EmptyTitle>
            <EmptyDescription>
              {searchQuery
                ? "Try adjusting your search query."
                : "Visit person detail pages to add them to your favorites."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid grid-cols-2 gap-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7">
          {persons.map((person, index) => (
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
