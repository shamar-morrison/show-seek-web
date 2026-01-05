"use client"

import { fetchTrailerKey, searchMedia } from "@/app/actions"
import { TrailerModal } from "@/components/trailer-modal"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { debounceWithCancel } from "@/lib/debounce"
import { getSearchResultInfo } from "@/lib/media-info"
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
  PlayIcon,
  Search01Icon,
  Tv01Icon,
  UserIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import Image from "next/image"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react"
import { toast } from "sonner"

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
  const [isTrailerOpen, setIsTrailerOpen] = useState(false)
  const [activeTrailer, setActiveTrailer] = useState<{
    key: string
    title: string
  } | null>(null)
  const [loadingMediaId, setLoadingMediaId] = useState<number | null>(null)

  // Handle watch trailer
  const handleWatchTrailer = async (result: TMDBSearchResult) => {
    if (result.media_type === "person") return

    const title = result.title || result.name || "Trailer"
    setLoadingMediaId(result.id)

    try {
      const key = await fetchTrailerKey(result.id, result.media_type)

      if (key) {
        setActiveTrailer({
          key,
          title,
        })
        setIsTrailerOpen(true)
      } else {
        toast.error(`No trailer available for ${title}`)
      }
    } catch (error) {
      console.error("Error fetching trailer:", error)
      toast.error("Failed to fetch trailer")
    } finally {
      setLoadingMediaId(null)
    }
  }

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
    if (query.trim()) {
      router.replace(`/search?q=${encodeURIComponent(query)}`, {
        scroll: false,
      })
      performSearch(query)
    }
  }

  // Sync with URL params
  // Track current query ref to avoid dependency cycles in effect
  const queryRef = useRef(query)
  useEffect(() => {
    queryRef.current = query
  }, [query])

  // Sync with URL params (e.g. back/forward navigation)
  useEffect(() => {
    const urlQuery = searchParams.get("q") || ""
    if (urlQuery !== queryRef.current) {
      setQuery(urlQuery)
      if (urlQuery) {
        performSearch(urlQuery)
      }
    }
  }, [searchParams, performSearch])

  // Filter results based on active tab
  const filteredResults =
    activeTab === "all"
      ? results.results
      : results.results.filter((r) => r.media_type === activeTab)

  // Get count for each tab
  const counts = useMemo(() => {
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
              onWatchTrailer={handleWatchTrailer}
              isLoading={loadingMediaId === result.id}
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
      <TrailerModal
        videoKey={activeTrailer?.key || null}
        isOpen={isTrailerOpen}
        onClose={() => {
          setIsTrailerOpen(false)
          setActiveTrailer(null)
        }}
        title={activeTrailer?.title || "Trailer"}
      />
    </div>
  )
}

/**
 * Search Result Card Component
 * Displays a single search result in a card format
 */
function SearchResultCard({
  result,
  onWatchTrailer,
  isLoading,
}: {
  result: TMDBSearchResult
  onWatchTrailer: (result: TMDBSearchResult) => void
  isLoading: boolean
}) {
  const {
    isPerson,
    title,
    imagePath,
    year,
    rating,
    mediaTypeLabel,
    MediaTypeIcon,
    href,
  } = getSearchResultInfo(result)

  const imageUrl = buildImageUrl(imagePath ?? null, "w342")

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
                icon={MediaTypeIcon}
                className="size-12 text-gray-600"
              />
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
              <HugeiconsIcon icon={MediaTypeIcon} className="size-3" />
              {mediaTypeLabel}
            </span>
            {year && (
              <>
                <span className="text-gray-600">•</span>
                <span>{year}</span>
              </>
            )}
            {rating !== null && rating > 0 && (
              <>
                <span className="text-gray-600">•</span>
                <span className="flex items-center gap-1 text-yellow-500">
                  <span className="text-xs text-yellow-500">★</span>
                  {rating}
                </span>
              </>
            )}
          </div>

          {/* Watch Trailer Button */}
          {!isPerson && (
            <Button
              size="sm"
              className="mt-3 w-full bg-muted font-semibold text-white transition-colors hover:bg-primary group-hover:text-white"
              onClick={(e) => {
                e.preventDefault()
                onWatchTrailer(result)
              }}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <HugeiconsIcon
                    icon={Loading03Icon}
                    className="size-4 animate-spin"
                  />
                  Loading...
                </>
              ) : (
                <>
                  <HugeiconsIcon icon={PlayIcon} className="size-4" />
                  Trailer
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </Link>
  )
}
