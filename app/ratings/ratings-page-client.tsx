"use client"

import { MediaCardWithActions } from "@/components/media-card-with-actions"
import { EpisodeRatingCard } from "@/components/ratings/episode-rating-card"
import { TrailerModal } from "@/components/trailer-modal"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { FilterSort, FilterState, SortState } from "@/components/ui/filter-sort"
import { FilterTabButton } from "@/components/ui/filter-tab-button"
import { SearchInput } from "@/components/ui/search-input"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/context/auth-context"
import {
  useEpisodeRatings,
  useMovieRatings,
  useTVRatings,
} from "@/hooks/use-ratings"
import { useTrailer } from "@/hooks/use-trailer"
import type { Rating } from "@/types/rating"
import type { TMDBMedia } from "@/types/tmdb"
import {
  Film01Icon,
  PlayCircle02Icon,
  Search01Icon,
  StarIcon,
  Tv01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useCallback, useMemo, useState } from "react"

type RatingTab = "movies" | "tv" | "episodes"

// Current year for year range filter
const CURRENT_YEAR = new Date().getFullYear()
const MIN_YEAR = 1950

// Sort fields for movie/TV ratings
const SORT_FIELDS = [
  { value: "ratedAt", label: "Recently Rated" },
  { value: "releaseDate", label: "Release Date" },
  { value: "userRating", label: "Your Rating" },
  { value: "title", label: "Alphabetically" },
]

// Sort fields for episode ratings
const EPISODE_SORT_FIELDS = [
  { value: "ratedAt", label: "Recently Rated" },
  { value: "userRating", label: "Your Rating" },
  { value: "tvShowName", label: "Show Name" },
  { value: "episodeName", label: "Episode Name" },
]

// Filter for user's personal rating (minimum)
const USER_RATING_OPTIONS = [
  { value: "0", label: "All Ratings" },
  { value: "9", label: "9+" },
  { value: "8", label: "8+" },
  { value: "7", label: "7+" },
  { value: "6", label: "6+" },
  { value: "5", label: "5+" },
]

/**
 * Ratings Page Client Component
 * Handles tab navigation between Movie, TV, and Episode ratings with filtering and sorting
 */
export function RatingsPageClient() {
  const { loading: authLoading } = useAuth()
  const [activeTab, setActiveTab] = useState<RatingTab>("movies")
  const [searchQuery, setSearchQuery] = useState("")

  // Filter state (for movies/TV only)
  const [filterState, setFilterState] = useState<FilterState>({
    userRating: "0",
  })
  const [yearRange, setYearRange] = useState<[number, number]>([
    MIN_YEAR,
    CURRENT_YEAR,
  ])

  // Sort state
  const [sortState, setSortState] = useState<SortState>({
    field: "ratedAt",
    direction: "desc",
  })

  const movieRatings = useMovieRatings(undefined, activeTab === "movies")
  const tvRatings = useTVRatings(undefined, activeTab === "tv")
  const episodeRatings = useEpisodeRatings(undefined, activeTab === "episodes")

  // Trailer hook
  const { isOpen, activeTrailer, loadingMediaId, watchTrailer, closeTrailer } =
    useTrailer()

  // Filter and sort movie/TV ratings
  const filteredAndSortedRatings = useMemo(() => {
    const currentRatings =
      activeTab === "movies" ? movieRatings.ratings : tvRatings.ratings

    // Filter ratings
    let filtered = currentRatings.filter((rating) => {
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        if (!(rating.title || "").toLowerCase().includes(query)) {
          return false
        }
      }

      // User rating filter
      const minUserRating = parseInt(filterState.userRating || "0")
      if (minUserRating > 0 && rating.rating < minUserRating) {
        return false
      }

      // Year range filter
      if (rating.releaseDate) {
        const year = new Date(rating.releaseDate).getFullYear()
        if (year < yearRange[0] || year > yearRange[1]) {
          return false
        }
      }

      return true
    })

    // Sort ratings
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0

      switch (sortState.field) {
        case "ratedAt":
          comparison = (a.ratedAt || 0) - (b.ratedAt || 0)
          break
        case "releaseDate": {
          const dateA = a.releaseDate ? new Date(a.releaseDate).getTime() : 0
          const dateB = b.releaseDate ? new Date(b.releaseDate).getTime() : 0
          comparison = dateA - dateB
          break
        }
        case "userRating":
          comparison = (a.rating || 0) - (b.rating || 0)
          break
        case "title":
          comparison = (a.title || "")
            .toLowerCase()
            .localeCompare((b.title || "").toLowerCase())
          break
      }

      return sortState.direction === "asc" ? comparison : -comparison
    })

    return sorted
  }, [
    activeTab,
    movieRatings.ratings,
    tvRatings.ratings,
    searchQuery,
    filterState,
    yearRange,
    sortState,
  ])

  // Filter and sort episode ratings
  const filteredAndSortedEpisodes = useMemo(() => {
    let filtered = episodeRatings.ratings.filter((rating) => {
      // Search filter - search by show name or episode name
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        const showName = (rating.tvShowName || "").toLowerCase()
        const episodeName = (
          rating.episodeName ||
          rating.title ||
          ""
        ).toLowerCase()
        if (!showName.includes(query) && !episodeName.includes(query)) {
          return false
        }
      }

      // User rating filter
      const minUserRating = parseInt(filterState.userRating || "0")
      if (minUserRating > 0 && rating.rating < minUserRating) {
        return false
      }

      return true
    })

    // Sort episodes
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0

      switch (sortState.field) {
        case "ratedAt":
          comparison = (a.ratedAt || 0) - (b.ratedAt || 0)
          break
        case "userRating":
          comparison = (a.rating || 0) - (b.rating || 0)
          break
        case "tvShowName":
          comparison = (a.tvShowName || "")
            .toLowerCase()
            .localeCompare((b.tvShowName || "").toLowerCase())
          break
        case "episodeName":
          comparison = (a.episodeName || a.title || "")
            .toLowerCase()
            .localeCompare((b.episodeName || b.title || "").toLowerCase())
          break
        default:
          comparison = (a.ratedAt || 0) - (b.ratedAt || 0)
      }

      return sortState.direction === "asc" ? comparison : -comparison
    })

    return sorted
  }, [episodeRatings.ratings, searchQuery, filterState, sortState])

  // Determine loading state based on active tab
  const isLoading =
    authLoading ||
    (activeTab === "movies" && movieRatings.loading) ||
    (activeTab === "tv" && tvRatings.loading) ||
    (activeTab === "episodes" && episodeRatings.loading)

  // Handle trailer click
  const handleWatchTrailer = useCallback(
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

  // Handle filter change
  const handleFilterChange = useCallback((key: string, value: string) => {
    setFilterState((prev) => ({ ...prev, [key]: value }))
  }, [])

  // Handle clear all filters
  const handleClearAll = useCallback(() => {
    setFilterState({ userRating: "0" })
    setYearRange([MIN_YEAR, CURRENT_YEAR])
    setSortState({ field: "ratedAt", direction: "desc" })
    setSearchQuery("")
  }, [])

  // Get the appropriate empty state text
  const getEmptyText = () => {
    switch (activeTab) {
      case "movies":
        return { type: "movie", plural: "movies" }
      case "tv":
        return { type: "TV show", plural: "TV shows" }
      case "episodes":
        return { type: "episode", plural: "episodes" }
    }
  }

  const emptyText = getEmptyText()

  // Check if filters are active (including search)
  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    filterState.userRating !== "0" ||
    yearRange[0] !== MIN_YEAR ||
    yearRange[1] !== CURRENT_YEAR

  // Convert rating to TMDBMedia
  const ratingToMedia = (
    rating: Rating,
    mediaType: "movie" | "tv",
  ): TMDBMedia => ({
    id: Number(rating.mediaId),
    media_type: mediaType,
    poster_path: rating.posterPath || null,
    backdrop_path: null,
    vote_average: 0,
    vote_count: 0,
    overview: "",
    popularity: 0,
    original_language: "en",
    genre_ids: [],
    adult: false,
    ...(mediaType === "movie"
      ? {
          title: rating.title || "Untitled",
          original_title: "",
          release_date: rating.releaseDate || "",
          video: false,
        }
      : {
          name: rating.title || "Untitled",
          original_name: "",
          first_air_date: rating.releaseDate || "",
          origin_country: [],
        }),
  })

  return (
    <div className="space-y-6 pb-12">
      {/* Search and Filter/Sort Row */}
      <div className="flex items-center gap-3">
        <SearchInput
          id="ratings-search-input"
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={
            activeTab === "episodes"
              ? "Search by show or episode name..."
              : "Search your ratings..."
          }
          className="flex-1"
        />
        <FilterSort
          filters={[
            {
              key: "userRating",
              label: "Your Rating",
              icon: StarIcon,
              options: USER_RATING_OPTIONS,
            },
          ]}
          filterState={filterState}
          onFilterChange={handleFilterChange}
          sortFields={
            activeTab === "episodes" ? EPISODE_SORT_FIELDS : SORT_FIELDS
          }
          sortState={sortState}
          onSortChange={setSortState}
          yearRange={
            activeTab !== "episodes"
              ? {
                  min: MIN_YEAR,
                  max: CURRENT_YEAR,
                  value: yearRange,
                  onChange: setYearRange,
                }
              : undefined
          }
          onClearAll={hasActiveFilters ? handleClearAll : undefined}
        />
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap items-center gap-3">
        <FilterTabButton
          label="Movies"
          count={movieRatings.count}
          isActive={activeTab === "movies"}
          icon={Film01Icon}
          onClick={() => setActiveTab("movies")}
        />
        <FilterTabButton
          label="TV Shows"
          count={tvRatings.count}
          isActive={activeTab === "tv"}
          icon={Tv01Icon}
          onClick={() => setActiveTab("tv")}
        />
        <FilterTabButton
          label="Episodes"
          count={episodeRatings.count}
          isActive={activeTab === "episodes"}
          icon={PlayCircle02Icon}
          onClick={() => setActiveTab("episodes")}
        />
      </div>

      {/* Content */}
      {isLoading ? (
        <RatingsGridSkeleton />
      ) : activeTab === "episodes" ? (
        // Episode ratings tab with filtering
        (() => {
          if (episodeRatings.ratings.length === 0) {
            // No episode ratings at all
            return (
              <Empty className="border border-white/10">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <HugeiconsIcon icon={PlayCircle02Icon} />
                  </EmptyMedia>
                  <EmptyTitle>No episode ratings yet</EmptyTitle>
                  <EmptyDescription>
                    Rate episodes from TV show detail pages to see them here.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )
          }

          if (filteredAndSortedEpisodes.length === 0 && hasActiveFilters) {
            // No episodes match filters
            return (
              <Empty className="border border-white/10">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <HugeiconsIcon icon={Search01Icon} />
                  </EmptyMedia>
                  <EmptyTitle>No results found</EmptyTitle>
                  <EmptyDescription>
                    {searchQuery.trim()
                      ? `No episodes match "${searchQuery}"`
                      : "No episodes match your current filters."}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )
          }

          return (
            <div className="grid grid-cols-2 gap-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7">
              {filteredAndSortedEpisodes.map((rating) => (
                <EpisodeRatingCard key={rating.id} rating={rating} />
              ))}
            </div>
          )
        })()
      ) : (
        // Movie/TV ratings tabs with filtering
        (() => {
          const currentRatings =
            activeTab === "movies" ? movieRatings : tvRatings
          const displayRatings = filteredAndSortedRatings

          if (currentRatings.ratings.length === 0) {
            // No ratings at all
            return (
              <Empty className="border border-white/10">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <HugeiconsIcon
                      icon={activeTab === "movies" ? Film01Icon : Tv01Icon}
                    />
                  </EmptyMedia>
                  <EmptyTitle>No {emptyText.type} ratings yet</EmptyTitle>
                  <EmptyDescription>
                    Rate {emptyText.plural} from their detail pages to see them
                    here.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )
          }

          if (displayRatings.length === 0 && hasActiveFilters) {
            // No ratings match filters/search
            return (
              <Empty className="border border-white/10">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <HugeiconsIcon icon={Search01Icon} />
                  </EmptyMedia>
                  <EmptyTitle>No results found</EmptyTitle>
                  <EmptyDescription>
                    {searchQuery.trim()
                      ? `No ${emptyText.plural} match "${searchQuery}"`
                      : `No ${emptyText.plural} match your current filters.`}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )
          }

          return (
            <div className="grid grid-cols-2 gap-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7">
              {displayRatings
                .filter((rating) => rating.mediaId != null)
                .map((rating) => {
                  const media = ratingToMedia(
                    rating,
                    activeTab === "movies" ? "movie" : "tv",
                  )

                  return (
                    <MediaCardWithActions
                      key={`${rating.mediaType}-${rating.mediaId}`}
                      media={media}
                      onWatchTrailer={handleWatchTrailer}
                      isLoading={
                        loadingMediaId === `${media.media_type}-${media.id}`
                      }
                    />
                  )
                })}
            </div>
          )
        })()
      )}

      {/* Trailer Modal */}
      <TrailerModal
        videoKey={activeTrailer?.key || null}
        isOpen={isOpen}
        onClose={closeTrailer}
        title={activeTrailer?.title || "Trailer"}
      />
    </div>
  )
}

/** Skeleton loading state for ratings grid */
function RatingsGridSkeleton() {
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
