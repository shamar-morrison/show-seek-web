"use client"

import { MediaCardWithActions } from "@/components/media-card-with-actions"
import { PageContainer } from "@/components/page-container"
import { TrailerModal } from "@/components/trailer-modal"
import { MoodPickerDialog } from "@/components/discover/mood-picker-dialog"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { type ComboboxOption } from "@/components/ui/filter-combobox"
import { FilterSelect, type FilterOption } from "@/components/ui/filter-select"
import { Pagination } from "@/components/ui/pagination"
import { VirtualizedFilterCombobox } from "@/components/ui/virtualized-filter-combobox"
import { useContentFilter } from "@/hooks/use-content-filter"
import { usePreferences } from "@/hooks/use-preferences"
import { useTrailer } from "@/hooks/use-trailer"
import { getMoodById, getRandomMood } from "@/lib/moods"
import { getDisplayMediaTitle } from "@/lib/media-title"
import { cn } from "@/lib/utils"
import { isActionableMedia } from "@/lib/tmdb-media"
import type {
  Genre,
  TMDBActionableMedia,
  TMDBDiscoverResponse,
  TMDBLanguage,
  TMDBWatchProviderOption,
} from "@/types/tmdb"
import { Cancel01Icon, Search01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react"

interface DiscoverFilters {
  moodId: string | null
  mediaType: "movie" | "tv"
  page: number
  year: number | null
  sortBy: "popularity" | "top_rated" | "newest"
  rating: number | null
  language: string | null
  genre: number | null
  provider: number | null
}

const DEFAULT_FILTERS: DiscoverFilters = {
  moodId: null,
  mediaType: "movie",
  page: 1,
  year: null,
  sortBy: "popularity",
  rating: null,
  language: null,
  genre: null,
  provider: null,
}

const SORT_OPTIONS: FilterOption[] = [
  { label: "Popularity", value: "popularity" },
  { label: "Top Rated", value: "top_rated" },
  { label: "Newest", value: "newest" },
]

const RATING_OPTIONS: FilterOption[] = [
  { label: "All Ratings", value: "" },
  { label: "5+", value: "5" },
  { label: "6+", value: "6" },
  { label: "7+", value: "7" },
  { label: "8+", value: "8" },
  { label: "9+", value: "9" },
]

const MEDIA_TYPE_OPTIONS: FilterOption[] = [
  { label: "Movies", value: "movie" },
  { label: "TV Shows", value: "tv" },
]

const generateYearOptions = (): FilterOption[] => {
  const currentYear = new Date().getFullYear()
  const options: FilterOption[] = [{ label: "All Years", value: "" }]
  for (let year = currentYear; year >= 1950; year--) {
    options.push({ label: year.toString(), value: year.toString() })
  }
  return options
}

function buildDiscoverUrl(filters: DiscoverFilters) {
  const params = new URLSearchParams()

  if (filters.moodId) {
    params.set("mood", filters.moodId)
    if (filters.mediaType !== "movie") {
      params.set("type", filters.mediaType)
    }
    if (filters.page > 1) {
      params.set("page", filters.page.toString())
    }

    return params.toString() ? `/discover?${params}` : "/discover"
  }

  if (filters.mediaType !== "movie") params.set("type", filters.mediaType)
  if (filters.page > 1) params.set("page", filters.page.toString())
  if (filters.year) params.set("year", filters.year.toString())
  if (filters.sortBy !== "popularity") params.set("sort", filters.sortBy)
  if (filters.rating) params.set("rating", filters.rating.toString())
  if (filters.language) params.set("language", filters.language)
  if (filters.genre) params.set("genre", filters.genre.toString())
  if (filters.provider) params.set("provider", filters.provider.toString())

  return params.toString() ? `/discover?${params}` : "/discover"
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
  const [isPending, startTransition] = useTransition()
  const { preferences } = usePreferences()
  const { isOpen, activeTrailer, loadingMediaId, watchTrailer, closeTrailer } =
    useTrailer()
  const [filters, setFilters] = useState<DiscoverFilters>(initialFilters)
  const [moodPickerOpen, setMoodPickerOpen] = useState(false)

  const filtersRef = useRef(filters)
  useEffect(() => {
    filtersRef.current = filters
  }, [filters])

  useEffect(() => {
    setFilters(initialFilters)
  }, [initialFilters])

  const pushFilters = useCallback(
    (nextFilters: DiscoverFilters) => {
      setFilters(nextFilters)
      startTransition(() => {
        router.push(buildDiscoverUrl(nextFilters))
      })
    },
    [router],
  )

  const updateFilters = useCallback(
    (
      newFilters: Partial<DiscoverFilters>,
      options?: { preservePage?: boolean },
    ) => {
      const currentFilters = filtersRef.current

      let updated: DiscoverFilters

      if (Object.prototype.hasOwnProperty.call(newFilters, "moodId")) {
        updated = {
          ...DEFAULT_FILTERS,
          mediaType: newFilters.mediaType ?? currentFilters.mediaType,
          moodId: newFilters.moodId ?? null,
          page: 1,
        }
      } else {
        updated = {
          ...currentFilters,
          ...newFilters,
          page: options?.preservePage
            ? newFilters.page ?? currentFilters.page
            : 1,
        }

        if (
          newFilters.mediaType &&
          newFilters.mediaType !== currentFilters.mediaType &&
          !currentFilters.moodId
        ) {
          updated.genre = null
        }
      }

      pushFilters(updated)
    },
    [pushFilters],
  )

  const results = initialResults
  const filteredResults = useContentFilter(results.results, {
    applyHideUnreleasedContent: true,
  })
  const actionableResults = filteredResults.filter(isActionableMedia)
  const selectedMood = useMemo(
    () => (filters.moodId ? getMoodById(filters.moodId) ?? null : null),
    [filters.moodId],
  )
  const isMoodMode = selectedMood !== null

  const handleWatchTrailer = useCallback(
    (media: TMDBActionableMedia) => {
      const title =
        getDisplayMediaTitle(media, preferences.showOriginalTitles) || "Unknown"
      watchTrailer(media.id, media.media_type, title)
    },
    [preferences.showOriginalTitles, watchTrailer],
  )

  const yearOptions: ComboboxOption[] = useMemo(() => generateYearOptions(), [])

  const genreOptions: ComboboxOption[] = useMemo(() => {
    const genres = filters.mediaType === "movie" ? movieGenres : tvGenres
    return [
      { label: "All Genres", value: "" },
      ...genres.map((genre) => ({
        label: genre.name,
        value: genre.id.toString(),
      })),
    ]
  }, [filters.mediaType, movieGenres, tvGenres])

  const languageOptions: ComboboxOption[] = useMemo(
    () => [
      { label: "All Languages", value: "" },
      ...languages.map((language) => ({
        label: language.english_name,
        value: language.iso_639_1,
      })),
    ],
    [languages],
  )

  const providerOptions: ComboboxOption[] = useMemo(() => {
    const seen = new Set<string>()
    return [
      { label: "All Providers", value: "" },
      ...providers
        .filter((provider) => {
          if (seen.has(provider.provider_name)) return false
          seen.add(provider.provider_name)
          return true
        })
        .map((provider) => ({
          label: provider.provider_name,
          value: provider.provider_id.toString(),
        })),
    ]
  }, [providers])

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

  const handlePageChange = useCallback(
    (page: number) => {
      updateFilters({ page }, { preservePage: true })
    },
    [updateFilters],
  )

  const clearFilters = useCallback(() => {
    pushFilters({ ...DEFAULT_FILTERS })
  }, [pushFilters])

  const clearMoodMode = useCallback(() => {
    pushFilters({
      ...DEFAULT_FILTERS,
      mediaType: filtersRef.current.mediaType,
    })
  }, [pushFilters])

  const handleSurpriseMe = useCallback(() => {
    const randomMood = getRandomMood(filtersRef.current.moodId ?? undefined)
    updateFilters({ moodId: randomMood.id })
    setMoodPickerOpen(false)
  }, [updateFilters])

  const handleMoodSelect = useCallback(
    (moodId: string) => {
      updateFilters({ moodId })
      setMoodPickerOpen(false)
    },
    [updateFilters],
  )

  const title = isMoodMode
    ? `${selectedMood.label} ${filters.mediaType === "movie" ? "Movies" : "TV Picks"}`
    : filters.mediaType === "movie"
      ? "Discover Movies"
      : "Discover TV Shows"

  const subtitle = isMoodMode
    ? selectedMood.supportingText
    : "Browse by year, language, genre, rating, or streaming provider."

  return (
    <>
      <main className="min-h-screen pt-28 pb-16">
        <PageContainer>
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-white/40">
                {isMoodMode ? "Mood Results" : "Standard Discovery"}
              </p>
              <h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">
                {title}
              </h2>
              <p className="mt-3 max-w-2xl text-sm text-white/58 sm:text-base">
                {subtitle}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {isMoodMode && selectedMood ? (
                <div
                  className="inline-flex items-center gap-1 rounded-full border p-1 pl-4"
                  style={{
                    borderColor: `${selectedMood.color}55`,
                    backgroundImage: `linear-gradient(135deg, ${selectedMood.color}30, rgba(7, 13, 22, 0.92) 78%)`,
                    boxShadow: `0 18px 50px -32px ${selectedMood.color}`,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setMoodPickerOpen(true)}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-white"
                  >
                    <span className="text-lg leading-none">
                      {selectedMood.emoji}
                    </span>
                    {selectedMood.label}
                  </button>
                  <button
                    type="button"
                    onClick={clearMoodMode}
                    aria-label="Clear mood"
                    className="ml-1 inline-flex size-7 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
                  >
                    <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setMoodPickerOpen(true)}
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-gradient-to-br from-white/[0.08] to-white/[0.02] px-5 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:border-white/25 hover:from-white/[0.12]"
                >
                  <span className="text-base leading-none">✨</span>
                  Pick a mood
                </button>
              )}

              {isMoodMode && (
                <div className="inline-flex rounded-full border border-white/10 bg-white/5 p-1">
                  {MEDIA_TYPE_OPTIONS.map((option) => {
                    const isActive = filters.mediaType === option.value

                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          updateFilters({
                            mediaType: option.value as "movie" | "tv",
                          })
                        }
                        className={cn(
                          "rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-200",
                          isActive
                            ? "bg-white text-black"
                            : "text-white/70 hover:text-white",
                        )}
                      >
                        {option.label}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {!isMoodMode && (
            <div className="mb-8 flex flex-wrap items-end gap-4">
              <FilterSelect
                label="Type"
                value={filters.mediaType}
                options={MEDIA_TYPE_OPTIONS}
                onChange={(value) =>
                  updateFilters({
                    mediaType: (value as "movie" | "tv") || "movie",
                  })
                }
              />

              <VirtualizedFilterCombobox
                label="Year"
                value={filters.year?.toString() || null}
                options={yearOptions}
                onChange={(value) =>
                  updateFilters({ year: value ? parseInt(value, 10) : null })
                }
                placeholder="All Years"
              />

              <FilterSelect
                label="Sort By"
                value={filters.sortBy}
                options={SORT_OPTIONS}
                onChange={(value) =>
                  updateFilters({
                    sortBy:
                      (value as "popularity" | "top_rated" | "newest") ||
                      "popularity",
                  })
                }
              />

              <FilterSelect
                label="Rating"
                value={filters.rating?.toString() || ""}
                options={RATING_OPTIONS}
                onChange={(value) =>
                  updateFilters({ rating: value ? parseInt(value, 10) : null })
                }
              />

              <VirtualizedFilterCombobox
                label="Language"
                value={filters.language}
                options={languageOptions}
                onChange={(value) => updateFilters({ language: value || null })}
                placeholder="All Languages"
              />

              <VirtualizedFilterCombobox
                label="Genre"
                value={filters.genre?.toString() || null}
                options={genreOptions}
                onChange={(value) =>
                  updateFilters({ genre: value ? parseInt(value, 10) : null })
                }
                placeholder="All Genres"
              />

              <div className="relative">
                <VirtualizedFilterCombobox
                  label="Streaming"
                  value={filters.provider?.toString() || null}
                  options={providerOptions}
                  onChange={(value) =>
                    updateFilters({
                      provider: value ? parseInt(value, 10) : null,
                    })
                  }
                  placeholder="All Providers"
                  popoverClassName="w-[380px]"
                />
              </div>

              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="lg"
                  onClick={clearFilters}
                  className="rounded-md text-gray-400 hover:text-white"
                >
                  <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
                  Clear all
                </Button>
              )}
            </div>
          )}

          {isPending && (
            <div className="mb-8 grid grid-cols-2 gap-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7">
              {Array.from({ length: 14 }).map((_, index) => (
                <div key={index} className="animate-pulse">
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

          {!isPending && filteredResults.length > 0 && (
            <div className="mb-12 grid grid-cols-2 gap-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7">
              {actionableResults.map((media) => (
                <MediaCardWithActions
                  key={`${media.media_type}-${media.id}`}
                  media={media}
                  onWatchTrailer={handleWatchTrailer}
                  isLoading={
                    loadingMediaId === `${media.media_type}-${media.id}`
                  }
                  preferOriginalTitles={preferences.showOriginalTitles}
                />
              ))}
            </div>
          )}

          {!isPending && filteredResults.length === 0 && (
            <Empty className="py-20">
              <EmptyMedia variant="icon">
                <HugeiconsIcon icon={Search01Icon} className="size-6" />
              </EmptyMedia>
              <EmptyHeader>
                <EmptyTitle>
                  {isMoodMode ? "No mood matches yet" : "No results found"}
                </EmptyTitle>
                <EmptyDescription>
                  {isMoodMode
                    ? "Try another mood or switch between movies and TV."
                    : "Try adjusting your filters to see more results."}
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                {isMoodMode ? (
                  <Button variant="outline" size="sm" onClick={handleSurpriseMe}>
                    Surprise me instead
                  </Button>
                ) : (
                  hasActiveFilters && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearFilters}
                      className="mt-4"
                    >
                      Clear all filters
                    </Button>
                  )
                )}
              </EmptyContent>
            </Empty>
          )}

          {!isPending && results.total_pages > 1 && (
            <div className="mt-8">
              <Pagination
                currentPage={filters.page}
                totalPages={Math.min(results.total_pages, 500)}
                totalResults={results.total_results}
                onPageChange={handlePageChange}
              />
            </div>
          )}
        </PageContainer>
      </main>

      <TrailerModal
        videoKey={activeTrailer?.key || null}
        isOpen={isOpen}
        onClose={closeTrailer}
        title={activeTrailer?.title}
      />

      <MoodPickerDialog
        open={moodPickerOpen}
        onOpenChange={setMoodPickerOpen}
        selectedMoodId={selectedMood?.id ?? null}
        onSelect={handleMoodSelect}
        onSurprise={handleSurpriseMe}
      />
    </>
  )
}
