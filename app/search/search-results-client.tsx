"use client"

import { searchMedia } from "@/app/actions"
import { MediaCardWithActions } from "@/components/media-card-with-actions"
import { PersonSearchCard } from "@/components/person-search-card"
import { TrailerModal } from "@/components/trailer-modal"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { FilterTabButton } from "@/components/ui/filter-tab-button"
import { Input } from "@/components/ui/input"
import { useSearchUrlSync } from "@/hooks/use-search-url-sync"
import { useTrailer } from "@/hooks/use-trailer"
import { useContentFilter } from "@/hooks/use-content-filter"
import { debounceWithCancel } from "@/lib/debounce"
import { cn } from "@/lib/utils"
import type {
  MediaType,
  TMDBMedia,
  TMDBSearchResponse,
  TMDBSearchResult,
} from "@/types/tmdb"
import {
  Film01Icon,
  Loading03Icon,
  Search01Icon,
  Tv01Icon,
  UserIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useState, useTransition } from "react"

const DEBOUNCE_DELAY = 300

type TabType = "all" | "movie" | "tv" | "person"

interface Tab {
  id: TabType
  label: string
  icon: typeof Film01Icon
}

const tabs: Tab[] = [
  { id: "all", label: "All", icon: Search01Icon },
  { id: "movie", label: "Movies", icon: Film01Icon },
  { id: "tv", label: "TV Shows", icon: Tv01Icon },
  { id: "person", label: "Person", icon: UserIcon },
]

interface SearchResultsClientProps {
  initialQuery: string
  initialResults: TMDBSearchResponse
}

/**
 * Search Results Client Component
 * Handles search input, tab filtering, and results display
 */
export function SearchResultsClient({
  initialQuery,
  initialResults,
}: SearchResultsClientProps) {
  const router = useRouter()

  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState(initialResults)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>("all")
  const [isPending, startTransition] = useTransition()

  // Trailer hook for modal state
  const { isOpen, activeTrailer, loadingMediaId, watchTrailer, closeTrailer } =
    useTrailer()

  // Handle watch trailer for MediaCard
  const handleWatchTrailerMedia = useCallback(
    (media: TMDBMedia) => {
      if (media.media_type === "person") return
      watchTrailer(
        media.id,
        media.media_type,
        media.title || media.name || "Trailer",
      )
    },
    [watchTrailer],
  )

  // Convert TMDBSearchResult to TMDBMedia for MediaCard
  const searchResultToMedia = useCallback(
    (result: TMDBSearchResult): TMDBMedia => ({
      id: result.id,
      media_type: result.media_type,
      adult: result.adult ?? false,
      backdrop_path: result.backdrop_path ?? null,
      poster_path: result.poster_path ?? result.profile_path ?? null,
      title: result.title,
      name: result.name,
      overview: result.overview ?? "",
      genre_ids: [],
      popularity: result.popularity ?? 0,
      release_date: result.release_date,
      first_air_date: result.first_air_date,
      vote_average: result.vote_average ?? 0,
      vote_count: 0,
      original_language: "",
      // Conditionally set original_title/original_name based on media_type
      // to avoid polluting the object with undefined values
      ...(result.media_type === "movie"
        ? { original_title: result.title }
        : result.media_type === "tv"
          ? { original_name: result.name }
          : {}),
    }),
    [],
  )

  // Perform search
  const performSearch = useCallback(async (searchQuery: string) => {
    setError(null)
    if (!searchQuery.trim()) {
      setResults({ page: 1, results: [], total_pages: 0, total_results: 0 })
      return
    }

    try {
      const response = await searchMedia(searchQuery)
      startTransition(() => {
        setResults(response)
      })
    } catch (err) {
      console.error("Search error:", err)
      setError("An error occurred while searching. Please try again.")
      startTransition(() => {
        setResults({ page: 1, results: [], total_pages: 0, total_results: 0 })
      })
    }
  }, [])

  // Debounced search
  const debouncedSearch = useMemo(() => {
    return debounceWithCancel((searchQuery: string) => {
      // Update URL
      router.replace(`/search?q=${encodeURIComponent(searchQuery)}`, {
        scroll: false,
      })
      performSearch(searchQuery)
    }, DEBOUNCE_DELAY)
  }, [performSearch, router])

  // Cleanup debounce timer on unmount or change
  useEffect(() => {
    return () => {
      debouncedSearch.cancel()
    }
  }, [debouncedSearch])

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setQuery(value)
    debouncedSearch(value)
  }

  // Handle form submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    debouncedSearch.cancel()
    if (query.trim()) {
      router.replace(`/search?q=${encodeURIComponent(query)}`, {
        scroll: false,
      })
      performSearch(query)
    }
  }

  // Sync with URL params
  useSearchUrlSync({ query, setQuery, performSearch })

  // Filter results based on active tab
  const filteredResults = useMemo(
    () =>
      activeTab === "all"
        ? results.results
        : results.results.filter((r) => r.media_type === activeTab),
    [results.results, activeTab],
  )

  // Memoize transformed media objects to prevent re-renders
  const transformedMedia = useMemo(
    () =>
      filteredResults.map((result) => ({
        result,
        media: searchResultToMedia(result),
      })),
    [filteredResults, searchResultToMedia],
  )

  // Filter out watched content
  const filteredTransformedMedia = useContentFilter(
    transformedMedia.map((item) => ({
      ...item,
      // Map to id for filtering
      id: item.media.id,
    })),
  )

  // Get count for each tab
  const counts = useMemo(() => {
    const tabCounts: Record<TabType, number> = {
      all: results.results.length,
      movie: 0,
      tv: 0,
      person: 0,
    }

    results.results.forEach((r) => {
      if (r.media_type in tabCounts) {
        tabCounts[r.media_type as MediaType]++
      }
    })

    return tabCounts
  }, [results.results])

  return (
    <div className="space-y-8 pb-12">
      {/* Search Header */}
      <div className="space-y-6">
        {/* Search Input */}
        <form onSubmit={handleSubmit} className="relative max-w-2xl">
          <HugeiconsIcon
            icon={isPending ? Loading03Icon : Search01Icon}
            className={cn(
              "absolute left-4 top-1/2 size-5 -translate-y-1/2 text-gray-400",
              isPending && "animate-spin",
            )}
          />
          <Input
            id="search-page-input"
            type="text"
            placeholder="Search movies, TV shows, and people..."
            value={query}
            onChange={handleInputChange}
            className="h-12 rounded-xl border-white/10 bg-white/5 pl-12 pr-4 text-lg text-white placeholder:text-gray-500 focus:border-primary/50 focus:ring-primary/20"
          />
        </form>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {tabs.map((tab) => (
            <FilterTabButton
              key={tab.id}
              label={tab.label}
              count={counts[tab.id]}
              isActive={activeTab === tab.id}
              icon={tab.icon}
              onClick={() => setActiveTab(tab.id)}
            />
          ))}
        </div>

        {/* Error Message */}
        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-center text-sm text-red-500">
            {error}
          </div>
        )}
      </div>

      {/* Results */}
      {isPending ? (
        <div className="flex items-center justify-center py-20">
          <HugeiconsIcon
            icon={Loading03Icon}
            className="size-8 animate-spin text-primary"
          />
        </div>
      ) : filteredTransformedMedia.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7">
          {filteredTransformedMedia.map(({ result, media }, index) =>
            result.media_type === "person" ? (
              <PersonSearchCard
                key={`person-${result.id}`}
                person={{
                  id: result.id,
                  name: result.name || "",
                  profile_path: result.profile_path,
                  known_for_department: result.known_for_department,
                }}
                priority={index < 7}
              />
            ) : (
              <MediaCardWithActions
                key={`${result.media_type}-${result.id}`}
                media={media}
                onWatchTrailer={handleWatchTrailerMedia}
                isLoading={
                  loadingMediaId === `${result.media_type}-${result.id}`
                }
              />
            ),
          )}
        </div>
      ) : query.trim() ? (
        <Empty className="py-20">
          <EmptyMedia variant="icon">
            <HugeiconsIcon icon={Search01Icon} className="size-6" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>No results found for &quot;{query}&quot;</EmptyTitle>
            <EmptyDescription>
              Try adjusting your search or browse different categories
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Empty className="py-20">
          <EmptyMedia variant="icon">
            <HugeiconsIcon icon={Search01Icon} className="size-6" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>Start typing to search</EmptyTitle>
            <EmptyDescription>
              Search for movies, TV shows, and people
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
      <TrailerModal
        videoKey={activeTrailer?.key || null}
        isOpen={isOpen}
        onClose={closeTrailer}
        title={activeTrailer?.title || "Trailer"}
      />
    </div>
  )
}
