"use client"

import { fetchTrailerKey } from "@/app/actions"
import { MediaCardWithActions } from "@/components/media-card-with-actions"
import { TrailerModal } from "@/components/trailer-modal"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { FilterTabButton } from "@/components/ui/filter-tab-button"
import { SearchInput } from "@/components/ui/search-input"
import { usePreferences } from "@/hooks/use-preferences"
import { useUrlStateSync } from "@/hooks/use-url-state-sync"
import {
  buildPersonCredits,
  getAvailablePersonCreditCombinations,
  getPersonCreditCombinationLabel,
  resolveInitialPersonCreditsSelection,
  type PersonCreditMediaType,
  type PersonCreditType,
} from "@/lib/person-credits"
import { getDisplayMediaTitle } from "@/lib/media-title"
import type { TMDBActionableMedia, TMDBPersonDetails } from "@/types/tmdb"
import {
  ArrowLeft02Icon,
  Search01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

interface PersonCreditsClientProps {
  person: TMDBPersonDetails
}

/** Credits rendered on first paint; further chunks load as you scroll. */
const INITIAL_VISIBLE_CREDITS = 42
/** Credits appended each time the sentinel scrolls into view. */
const CREDITS_PAGE_SIZE = 42

export function PersonCreditsClient({ person }: PersonCreditsClientProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [trailerKey, setTrailerKey] = useState<string | null>(null)
  const [selectedTrailerMedia, setSelectedTrailerMedia] =
    useState<TMDBActionableMedia | null>(null)
  const [loadingMediaId, setLoadingMediaId] = useState<number | null>(null)
  const { preferences } = usePreferences()

  const creditsByTab = useMemo(() => buildPersonCredits(person), [person])
  const availableCombinations = useMemo(
    () => getAvailablePersonCreditCombinations(creditsByTab),
    [creditsByTab],
  )
  const defaultSelection = useMemo(
    () => resolveInitialPersonCreditsSelection(person),
    [person],
  )
  const [urlState, setUrlState] = useUrlStateSync<{
    activeMediaType: PersonCreditMediaType
    activeCreditType: PersonCreditType
    searchQuery: string
  }>({
    keys: ["mediaType", "creditType", "q"],
    parse: (params) => {
      const resolvedSelection = resolveInitialPersonCreditsSelection(
        person,
        params.get("mediaType") ?? undefined,
        params.get("creditType") ?? undefined,
      )

      return {
        activeMediaType: resolvedSelection.mediaType,
        activeCreditType: resolvedSelection.creditType,
        // Don't trim here: trimming would eat trailing spaces while the user
        // is still typing (each keystroke round-trips through the URL).
        // Matching already trims via filteredItems.
        searchQuery: params.get("q") ?? "",
      }
    },
    serialize: (state) => {
      const params = new URLSearchParams()

      const isDefaultSelection =
        state.activeMediaType === defaultSelection.mediaType &&
        state.activeCreditType === defaultSelection.creditType

      if (!isDefaultSelection) {
        params.set("mediaType", state.activeMediaType)
        params.set("creditType", state.activeCreditType)
      }

      if (state.searchQuery.trim()) {
        params.set("q", state.searchQuery)
      }

      return params
    },
  })
  const activeMediaType = urlState.activeMediaType
  const activeCreditType = urlState.activeCreditType
  const searchQuery = urlState.searchQuery
  const activeCombination =
    availableCombinations.find(
      (combination) =>
        combination.mediaType === activeMediaType &&
        combination.creditType === activeCreditType,
    ) ||
    availableCombinations[0] ||
    null
  const currentItems = activeCombination?.items || []
  const totalCount = activeCombination?.count || 0

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return currentItems

    return currentItems.filter((item) =>
      [
        item.title,
        item.name,
        item.original_title,
        item.original_name,
      ].some((value) => value?.toLowerCase().includes(query)),
    )
  }, [currentItems, searchQuery])

  // Incremental rendering: mount only the first chunk so tab switches stay
  // fast, then append more as the sentinel scrolls into view.
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_CREDITS)
  const sentinelRef = useRef<HTMLDivElement>(null)

  // Reset to the first chunk whenever the list identity changes.
  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE_CREDITS)
  }, [activeMediaType, activeCreditType, searchQuery, person.id])

  const hasMoreItems = visibleCount < filteredItems.length
  const visibleItems = hasMoreItems
    ? filteredItems.slice(0, visibleCount)
    : filteredItems

  useEffect(() => {
    if (!hasMoreItems) return
    const node = sentinelRef.current
    if (!node) return

    const total = filteredItems.length
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisibleCount((count) => Math.min(count + CREDITS_PAGE_SIZE, total))
        }
      },
      { rootMargin: "600px" },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasMoreItems, filteredItems.length])

  const handleWatchTrailer = async (media: TMDBActionableMedia) => {
    setLoadingMediaId(media.id)
    try {
      const key = await fetchTrailerKey(media.id, media.media_type)
      if (key) {
        setTrailerKey(key)
        setSelectedTrailerMedia(media)
        setIsModalOpen(true)
      } else {
        toast.error("No trailer available for this title")
      }
    } catch {
      toast.error("Failed to load trailer")
    } finally {
      setLoadingMediaId(null)
    }
  }

  const handleCombinationChange = (
    mediaType: PersonCreditMediaType,
    creditType: PersonCreditType,
  ) => {
    if (mediaType === activeMediaType && creditType === activeCreditType) {
      return
    }

    setUrlState({
      activeMediaType: mediaType,
      activeCreditType: creditType,
      searchQuery: "",
    })
  }

  return (
    <div className="space-y-6 pb-12">
      <Link
        href={`/person/${person.id}`}
        className="inline-flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-white"
      >
        <HugeiconsIcon icon={ArrowLeft02Icon} className="size-4" />
        Back to {person.name}
      </Link>

      <h1 className="text-3xl font-bold text-white">{person.name} Credits</h1>

      {availableCombinations.length > 1 && (
        <div className="flex flex-wrap gap-2 border-b border-white/10 pb-4">
          {availableCombinations.map((combination) => {
            const isActive =
              combination.mediaType === activeCombination?.mediaType &&
              combination.creditType === activeCombination?.creditType

            return (
              <FilterTabButton
                key={`${combination.mediaType}-${combination.creditType}`}
                label={combination.label}
                count={combination.count}
                isActive={isActive}
                onClick={() =>
                  handleCombinationChange(
                    combination.mediaType,
                    combination.creditType,
                  )
                }
              />
            )
          })}
        </div>
      )}

      {activeCombination && (
        <SearchInput
          id="person-credits-search-input"
          value={searchQuery}
          onChange={(value) =>
            setUrlState((currentState) => ({
              ...currentState,
              searchQuery: value,
            }))
          }
          placeholder="Search by title or original title..."
          className="w-full"
          aria-label="Search by title or original title"
        />
      )}

      {totalCount > 0 && (
        <p className="text-sm text-gray-400">
          {filteredItems.length === totalCount
            ? `${totalCount} ${totalCount === 1 ? "credit" : "credits"}`
            : `Showing ${filteredItems.length} of ${totalCount}`}
        </p>
      )}

      {!activeCombination ? (
        <Empty className="border border-white/10">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={UserGroupIcon} />
            </EmptyMedia>
            <EmptyTitle>No credits available</EmptyTitle>
            <EmptyDescription>
              We don&apos;t have visible credits for {person.name} yet.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : totalCount === 0 ? (
        <Empty className="border border-white/10">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={UserGroupIcon} />
            </EmptyMedia>
            <EmptyTitle>
              No {getPersonCreditCombinationLabel(activeMediaType, activeCreditType).toLowerCase()}{" "}
              credits available
            </EmptyTitle>
            <EmptyDescription>
              We don&apos;t have any {activeCombination.label.toLowerCase()} credits
              for {person.name} yet.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : filteredItems.length === 0 ? (
        <Empty className="border border-white/10">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={Search01Icon} />
            </EmptyMedia>
            <EmptyTitle>No results found</EmptyTitle>
            <EmptyDescription>
              No {activeCombination.label.toLowerCase()} credits match{" "}
              &quot;{searchQuery}&quot;
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7">
            {visibleItems.map((media, index) => (
              <MediaCardWithActions
                key={`${activeMediaType}-${activeCreditType}-${media.id}`}
                media={media}
                buttonText="Trailer"
                onWatchTrailer={handleWatchTrailer}
                isLoading={loadingMediaId === media.id}
                priority={index < 7}
                preferOriginalTitles={preferences.showOriginalTitles}
              />
            ))}
          </div>
          {hasMoreItems && (
            <div
              ref={sentinelRef}
              className="flex items-center justify-center gap-3 py-6 text-sm text-gray-400"
              data-testid="credits-load-more-sentinel"
            >
              <span
                className="size-4 animate-spin rounded-full border-2 border-white/20 border-t-white/80"
                aria-hidden="true"
              />
              Showing {visibleItems.length} of {filteredItems.length} — loading
              more…
            </div>
          )}
        </>
      )}

      <TrailerModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedTrailerMedia(null)
        }}
        videoKey={trailerKey}
        title={
          (selectedTrailerMedia &&
            getDisplayMediaTitle(
              selectedTrailerMedia,
              preferences.showOriginalTitles,
            )) ||
          "Trailer"
        }
      />
    </div>
  )
}
