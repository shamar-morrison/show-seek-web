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
import { FilterTabButton } from "@/components/ui/filter-tab-button"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/context/auth-context"
import {
  useEpisodeRatings,
  useMovieRatings,
  useTVRatings,
  type RatingSortOption,
} from "@/hooks/use-ratings"
import { useTrailer } from "@/hooks/use-trailer"
import type { TMDBMedia } from "@/types/tmdb"
import {
  Film01Icon,
  PlayCircle02Icon,
  StarIcon,
  Tv01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useCallback, useState } from "react"

type RatingTab = "movies" | "tv" | "episodes"

/**
 * Ratings Page Client Component
 * Handles tab navigation between Movie, TV, and Episode ratings with sorting
 */
export function RatingsPageClient() {
  const { user, loading: authLoading } = useAuth()
  const [activeTab, setActiveTab] = useState<RatingTab>("movies")
  const [sortBy, setSortBy] = useState<RatingSortOption>("ratedAt")

  const movieRatings = useMovieRatings(sortBy, activeTab === "movies")
  const tvRatings = useTVRatings(sortBy, activeTab === "tv")
  const episodeRatings = useEpisodeRatings(sortBy, activeTab === "episodes")

  // Trailer hook
  const { isOpen, activeTrailer, loadingMediaId, watchTrailer, closeTrailer } =
    useTrailer()

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

  return (
    <div className="space-y-6 pb-12">
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

        {/* Sort Dropdown */}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-gray-400">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as RatingSortOption)}
            className="rounded-md border border-white/10 bg-black px-3 py-1.5 text-sm text-white focus:border-primary focus:outline-none"
          >
            <option value="ratedAt">Recently Rated</option>
            <option value="rating">Highest Rating</option>
            <option value="alphabetical">Alphabetical</option>
          </select>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <RatingsGridSkeleton />
      ) : activeTab === "episodes" ? (
        // Episode ratings tab
        episodeRatings.ratings.length === 0 ? (
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
        ) : (
          <div className="grid grid-cols-2 gap-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7">
            {episodeRatings.ratings.map((rating) => (
              <EpisodeRatingCard key={rating.id} rating={rating} />
            ))}
          </div>
        )
      ) : (
        // Movie/TV ratings tabs
        (() => {
          const currentRatings =
            activeTab === "movies" ? movieRatings : tvRatings
          return currentRatings.ratings.length === 0 ? (
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
          ) : (
            <div className="grid grid-cols-2 gap-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7">
              {currentRatings.ratings
                .filter((rating) => rating.mediaId != null)
                .map((rating) => {
                  // Convert rating data to TMDBMedia format
                  const media: TMDBMedia = {
                    id: Number(rating.mediaId),
                    media_type: activeTab === "movies" ? "movie" : "tv",
                    poster_path: rating.posterPath || null,
                    backdrop_path: null,
                    vote_average: 0,
                    vote_count: 0,
                    overview: "",
                    popularity: 0,
                    original_language: "en",
                    genre_ids: [],
                    adult: false,
                    ...(activeTab === "movies"
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
                  }

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
