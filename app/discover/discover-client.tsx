"use client"

import { MediaCard } from "@/components/media-card"
import { Navbar } from "@/components/navbar"
import { PageContainer } from "@/components/page-container"
import { TrailerModal } from "@/components/trailer-modal"
import { Button } from "@/components/ui/button"
import { type ComboboxOption } from "@/components/ui/filter-combobox"
import { FilterSelect, type FilterOption } from "@/components/ui/filter-select"
import { Pagination } from "@/components/ui/pagination"
import { VirtualizedFilterCombobox } from "@/components/ui/virtualized-filter-combobox"
import { useTrailer } from "@/hooks/use-trailer"
import type {
  Genre,
  TMDBDiscoverResponse,
  TMDBLanguage,
  TMDBMedia,
  TMDBWatchProviderOption,
} from "@/types/tmdb"
import { Cancel01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useMemo, useState, useTransition } from "react"

// Filter state interface
interface DiscoverFilters {
  mediaType: "movie" | "tv"
  page: number
  year: number | null
  sortBy: "popularity" | "top_rated" | "newest"
  rating: number | null
  language: string | null
  genre: number | null
  provider: number | null
}

// Default filter values
const DEFAULT_FILTERS: DiscoverFilters = {
  mediaType: "movie",
  page: 1,
  year: null,
  sortBy: "popularity",
  rating: null,
  language: null,
  genre: null,
  provider: null,
}

// Sort options
const SORT_OPTIONS: FilterOption[] = [
  { label: "Popularity", value: "popularity" },
  { label: "Top Rated", value: "top_rated" },
  { label: "Newest", value: "newest" },
]

// Rating options
const RATING_OPTIONS: FilterOption[] = [
  { label: "All Ratings", value: "" },
  { label: "5+", value: "5" },
  { label: "6+", value: "6" },
  { label: "7+", value: "7" },
  { label: "8+", value: "8" },
  { label: "9+", value: "9" },
]

// Media type options
const MEDIA_TYPE_OPTIONS: FilterOption[] = [
  { label: "Movies", value: "movie" },
  { label: "TV Shows", value: "tv" },
]

// Generate year options from 1950 to current year
const generateYearOptions = (): FilterOption[] => {
  const currentYear = new Date().getFullYear()
  const options: FilterOption[] = [{ label: "All Years", value: "" }]
  for (let year = currentYear; year >= 1950; year--) {
    options.push({ label: year.toString(), value: year.toString() })
  }
  return options
}

interface DiscoverClientProps {
  movieGenres: Genre[]
  tvGenres: Genre[]
  languages: TMDBLanguage[]
  providers: TMDBWatchProviderOption[]
  initialResults: TMDBDiscoverResponse
  initialFilters: DiscoverFilters
}

export function DiscoverClient({
  movieGenres,
  tvGenres,
  languages,
  providers,
  initialResults,
  initialFilters,
}: DiscoverClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const { isOpen, activeTrailer, loadingMediaId, watchTrailer, closeTrailer } =
    useTrailer()

  const [filters, setFilters] = useState<DiscoverFilters>(initialFilters)
  // Results come from server via initialResults and update on navigation
  const results = initialResults

  // Handle watch trailer for a media item
  const handleWatchTrailer = useCallback(
    (media: TMDBMedia) => {
      const title = media.title || media.name || "Unknown"
      watchTrailer(media.id, media.media_type as "movie" | "tv", title)
    },
    [watchTrailer],
  )

  const yearOptions: ComboboxOption[] = useMemo(() => generateYearOptions(), [])

  const genreOptions: ComboboxOption[] = useMemo(() => {
    const genres = filters.mediaType === "movie" ? movieGenres : tvGenres
    return [
      { label: "All Genres", value: "" },
      ...genres.map((g) => ({ label: g.name, value: g.id.toString() })),
    ]
  }, [filters.mediaType, movieGenres, tvGenres])

  const languageOptions: ComboboxOption[] = useMemo(() => {
    return [
      { label: "All Languages", value: "" },
      ...languages.map((l) => ({
        label: l.english_name,
        value: l.iso_639_1,
      })),
    ]
  }, [languages])

  const providerOptions: ComboboxOption[] = useMemo(() => {
    // Deduplicate providers using Set based on provider_name (not ID)
    // since providers with same name but different IDs appear as duplicates
    const seen = new Set<string>()
    return providers
      .filter((p) => {
        if (seen.has(p.provider_name)) return false
        seen.add(p.provider_name)
        return true
      })
      .map((p) => ({
        label: p.provider_name,
        value: p.provider_id.toString(),
      }))
  }, [providers])

  // Check if any filter differs from defaults
  const hasActiveFilters = useMemo(() => {
    return (
      filters.year !== null ||
      filters.sortBy !== "popularity" ||
      filters.rating !== null ||
      filters.language !== null ||
      filters.genre !== null ||
      filters.provider !== null
    )
  }, [filters])

  const updateFilters = useCallback(
    (newFilters: Partial<DiscoverFilters>) => {
      const updated = { ...filters, ...newFilters, page: 1 }

      // If media type changed, reset genre (since genres differ between movie/tv)
      if (newFilters.mediaType && newFilters.mediaType !== filters.mediaType) {
        updated.genre = null
      }

      setFilters(updated)

      const params = new URLSearchParams()
      if (updated.mediaType !== "movie") params.set("type", updated.mediaType)
      if (updated.year) params.set("year", updated.year.toString())
      if (updated.sortBy !== "popularity") params.set("sort", updated.sortBy)
      if (updated.rating) params.set("rating", updated.rating.toString())
      if (updated.language) params.set("language", updated.language)
      if (updated.genre) params.set("genre", updated.genre.toString())
      if (updated.provider) params.set("provider", updated.provider.toString())

      startTransition(() => {
        const url = params.toString() ? `/discover?${params}` : "/discover"
        router.push(url)
      })
    },
    [filters, router],
  )

  const handlePageChange = useCallback(
    (page: number) => {
      const updated = { ...filters, page }
      setFilters(updated)

      const params = new URLSearchParams(searchParams.toString())
      if (page > 1) {
        params.set("page", page.toString())
      } else {
        params.delete("page")
      }

      startTransition(() => {
        const url = params.toString() ? `/discover?${params}` : "/discover"
        router.push(url)
      })
    },
    [filters, router, searchParams],
  )

  const clearFilters = useCallback(() => {
    setFilters({ ...DEFAULT_FILTERS })
    startTransition(() => {
      router.push("/discover")
    })
  }, [router])

  const title =
    filters.mediaType === "movie" ? "Discover Movies" : "Discover TV Shows"

  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-32 pb-16">
        <PageContainer>
          {/* Header */}
          <div className="mb-12">
            <h1 className="text-3xl font-bold text-white sm:text-4xl">
              {title}
            </h1>
          </div>

          {/* Filters Row */}
          <div className="mb-8 flex flex-wrap items-end gap-4">
            {/* Media Type */}
            <FilterSelect
              label="Type"
              value={filters.mediaType}
              options={MEDIA_TYPE_OPTIONS}
              onChange={(val) =>
                updateFilters({ mediaType: (val as "movie" | "tv") || "movie" })
              }
            />

            {/* Year */}
            <VirtualizedFilterCombobox
              label="Year"
              value={filters.year?.toString() || null}
              options={yearOptions}
              onChange={(val) =>
                updateFilters({ year: val ? parseInt(val) : null })
              }
              placeholder="All Years"
            />

            {/* Sort By */}
            <FilterSelect
              label="Sort By"
              value={filters.sortBy}
              options={SORT_OPTIONS}
              onChange={(val) =>
                updateFilters({
                  sortBy:
                    (val as "popularity" | "top_rated" | "newest") ||
                    "popularity",
                })
              }
            />

            {/* Rating */}
            <FilterSelect
              label="Rating"
              value={filters.rating?.toString() || ""}
              options={RATING_OPTIONS}
              onChange={(val) =>
                updateFilters({ rating: val ? parseInt(val) : null })
              }
            />

            {/* Language */}
            <VirtualizedFilterCombobox
              label="Language"
              value={filters.language}
              options={languageOptions}
              onChange={(val) => updateFilters({ language: val || null })}
              placeholder="All Languages"
            />

            {/* Genre */}
            <VirtualizedFilterCombobox
              label="Genre"
              value={filters.genre?.toString() || null}
              options={genreOptions}
              onChange={(val) =>
                updateFilters({ genre: val ? parseInt(val) : null })
              }
              placeholder="All Genres"
            />

            {/* Streaming Provider */}
            <VirtualizedFilterCombobox
              label="Streaming"
              value={filters.provider?.toString() || null}
              options={providerOptions}
              onChange={(val) =>
                updateFilters({ provider: val ? parseInt(val) : null })
              }
              placeholder="Any Provider"
              popoverClassName="w-[380px]"
            />

            {/* Clear All Button */}
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="lg"
                onClick={clearFilters}
                className="text-gray-400 hover:text-white rounded-md"
              >
                <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
                Clear all
              </Button>
            )}
          </div>

          {/* Loading State */}
          {isPending && (
            <div className="mb-8 grid grid-cols-2 gap-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7">
              {Array.from({ length: 14 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="aspect-2/3 rounded-xl bg-gray-800" />
                  <div className="mt-3 space-y-2 p-3">
                    <div className="h-4 w-3/4 rounded bg-gray-800" />
                    <div className="h-3 w-1/2 rounded bg-gray-800" />
                    <div className="h-8 w-full rounded bg-gray-800" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Results Grid */}
          {!isPending && results.results.length > 0 && (
            <div className="mb-12 grid grid-cols-2 gap-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7">
              {results.results.map((media) => (
                <MediaCard
                  key={`${media.media_type}-${media.id}`}
                  media={media}
                  onWatchTrailer={handleWatchTrailer}
                  isLoading={loadingMediaId === media.id}
                  showRating
                />
              ))}
            </div>
          )}

          {/* Empty State */}
          {!isPending && results.results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-lg text-gray-400">No results found</p>
              <p className="mt-2 text-sm text-gray-500">
                Try adjusting your filters to see more results
              </p>
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearFilters}
                  className="mt-4"
                >
                  Clear all filters
                </Button>
              )}
            </div>
          )}

          {/* Pagination */}
          {!isPending && results.total_pages > 1 && (
            <div className="mt-8">
              <Pagination
                currentPage={filters.page}
                totalPages={Math.min(results.total_pages, 500)} // TMDB limits to 500 pages
                totalResults={results.total_results}
                onPageChange={handlePageChange}
              />
            </div>
          )}
        </PageContainer>
      </main>

      {/* Trailer Modal */}
      <TrailerModal
        videoKey={activeTrailer?.key || null}
        isOpen={isOpen}
        onClose={closeTrailer}
        title={activeTrailer?.title}
      />
    </>
  )
}
