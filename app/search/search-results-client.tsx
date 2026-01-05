"use client"

import { searchMedia } from "@/app/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { debounce } from "@/lib/debounce"
import { buildImageUrl } from "@/lib/tmdb"
import { cn } from "@/lib/utils"
import type {
  MediaType,
  TMDBSearchResponse,
  TMDBSearchResult,
} from "@/types/tmdb"
import {
  Film01Icon,
  Loading03Icon,
  Search01Icon,
  StarIcon,
  Tv01Icon,
  UserIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import Image from "next/image"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useState, useTransition } from "react"

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
  const searchParams = useSearchParams()
  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState(initialResults)
  const [activeTab, setActiveTab] = useState<TabType>("all")
  const [isPending, startTransition] = useTransition()

  // Perform search
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults({ page: 1, results: [], total_pages: 0, total_results: 0 })
      return
    }

    startTransition(async () => {
      const response = await searchMedia(searchQuery)
      setResults(response)
    })
  }, [])

  // Debounced search
  const debouncedSearch = useCallback(
    debounce((searchQuery: string) => {
      // Update URL
      router.replace(`/search?q=${encodeURIComponent(searchQuery)}`, {
        scroll: false,
      })
      performSearch(searchQuery)
    }, DEBOUNCE_DELAY),
    [performSearch, router],
  )

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setQuery(value)
    debouncedSearch(value)
  }

  // Handle form submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      router.replace(`/search?q=${encodeURIComponent(query)}`, {
        scroll: false,
      })
      performSearch(query)
    }
  }

  // Sync with URL params
  useEffect(() => {
    const urlQuery = searchParams.get("q") || ""
    if (urlQuery !== query) {
      setQuery(urlQuery)
      if (urlQuery) {
        performSearch(urlQuery)
      }
    }
  }, [searchParams, performSearch, query])

  // Filter results based on active tab
  const filteredResults =
    activeTab === "all"
      ? results.results
      : results.results.filter((r) => r.media_type === activeTab)

  // Get count for each tab
  const getCounts = () => {
    const counts: Record<TabType, number> = {
      all: results.results.length,
      movie: 0,
      tv: 0,
      person: 0,
    }

    results.results.forEach((r) => {
      if (r.media_type in counts) {
        counts[r.media_type as MediaType]++
      }
    })

    return counts
  }

  const counts = getCounts()

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
            type="text"
            placeholder="Search movies, TV shows, and people..."
            value={query}
            onChange={handleInputChange}
            className="h-14 rounded-xl border-white/10 bg-white/5 pl-12 pr-4 text-lg text-white placeholder:text-gray-500 focus:border-primary/50 focus:ring-primary/20"
          />
        </form>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {tabs.map((tab) => (
            <Button
              key={tab.id}
              variant={activeTab === tab.id ? "default" : "ghost"}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "shrink-0 gap-2",
                activeTab === tab.id
                  ? "bg-primary text-white hover:bg-primary/90"
                  : "text-gray-400 hover:bg-white/10 hover:text-white",
              )}
            >
              <HugeiconsIcon icon={tab.icon} className="size-4" />
              {tab.label}
              <span
                className={cn(
                  "ml-1 rounded-full px-2 py-0.5 text-xs",
                  activeTab === tab.id
                    ? "bg-white/20"
                    : "bg-white/10 text-gray-500",
                )}
              >
                {counts[tab.id]}
              </span>
            </Button>
          ))}
        </div>
      </div>

      {/* Results */}
      {isPending ? (
        <div className="flex items-center justify-center py-20">
          <HugeiconsIcon
            icon={Loading03Icon}
            className="size-8 animate-spin text-primary"
          />
        </div>
      ) : filteredResults.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredResults.map((result) => (
            <SearchResultCard
              key={`${result.media_type}-${result.id}`}
              result={result}
            />
          ))}
        </div>
      ) : query.trim() ? (
        <div className="py-20 text-center">
          <p className="text-lg text-gray-400">
            No results found for &quot;{query}&quot;
          </p>
          <p className="mt-2 text-sm text-gray-500">
            Try adjusting your search or browse different categories
          </p>
        </div>
      ) : (
        <div className="py-20 text-center">
          <HugeiconsIcon
            icon={Search01Icon}
            className="mx-auto size-16 text-gray-600"
          />
          <p className="mt-4 text-lg text-gray-400">
            Start typing to search for movies, TV shows, and people
          </p>
        </div>
      )}
    </div>
  )
}

/**
 * Search Result Card Component
 * Displays a single search result in a card format
 */
function SearchResultCard({ result }: { result: TMDBSearchResult }) {
  const isMovie = result.media_type === "movie"
  const isTV = result.media_type === "tv"
  const isPerson = result.media_type === "person"

  const title = result.title || result.name || "Unknown"
  const imagePath = isPerson ? result.profile_path : result.poster_path
  const imageUrl = buildImageUrl(imagePath ?? null, "w342")

  const dateStr = isMovie ? result.release_date : result.first_air_date
  const year = dateStr ? dateStr.split("-")[0] : null

  const rating =
    result.vote_average && !isPerson
      ? Math.round(result.vote_average * 10) / 10
      : null

  const href = isMovie
    ? `/movie/${result.id}`
    : isTV
      ? `/tv/${result.id}`
      : `/person/${result.id}`

  const getMediaTypeInfo = () => {
    if (isMovie) return { label: "Movie", icon: Film01Icon }
    if (isTV) return { label: "TV Show", icon: Tv01Icon }
    return { label: result.known_for_department || "Person", icon: UserIcon }
  }

  const mediaTypeInfo = getMediaTypeInfo()

  return (
    <Link href={href} className="group block">
      <div className="overflow-hidden rounded-xl bg-white/5 transition-all duration-300 hover:bg-white/10">
        {/* Image */}
        <div className="relative aspect-2/3 w-full overflow-hidden bg-gray-900">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={title}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <HugeiconsIcon
                icon={mediaTypeInfo.icon}
                className="size-12 text-gray-600"
              />
            </div>
          )}

          {/* Rating Badge */}
          {rating !== null && rating > 0 && (
            <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/80 px-2 py-1 text-xs font-medium text-yellow-500">
              <HugeiconsIcon icon={StarIcon} className="size-3" />
              {rating}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-3">
          <h3 className="line-clamp-1 text-sm font-semibold text-white">
            {title}
          </h3>
          <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <HugeiconsIcon icon={mediaTypeInfo.icon} className="size-3" />
              {mediaTypeInfo.label}
            </span>
            {year && (
              <>
                <span className="text-gray-600">•</span>
                <span>{year}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}
