"use client"

import { AuthModal } from "@/components/auth-modal"
import { MediaCard } from "@/components/media-card"
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
  useMovieRatings,
  useTVRatings,
  type RatingSortOption,
} from "@/hooks/use-ratings"
import { useTrailer } from "@/hooks/use-trailer"
import type { TMDBMedia } from "@/types/tmdb"
import { Film01Icon, StarIcon, Tv01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useCallback, useState } from "react"

type RatingTab = "movies" | "tv"

/**
 * Ratings Page Client Component
 * Handles tab navigation between Movie and TV ratings with sorting
 */
export function RatingsPageClient() {
  const { user, loading: authLoading } = useAuth()
  const [activeTab, setActiveTab] = useState<RatingTab>("movies")
  const [sortBy, setSortBy] = useState<RatingSortOption>("ratedAt")

  const movieRatings = useMovieRatings(sortBy, activeTab === "movies")
  const tvRatings = useTVRatings(sortBy, activeTab === "tv")

  // Trailer hook
  const { isOpen, activeTrailer, loadingMediaId, watchTrailer, closeTrailer } =
    useTrailer()

  const currentRatings = activeTab === "movies" ? movieRatings : tvRatings
  const isLoading = authLoading || currentRatings.loading

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

  // Show auth prompt if not logged in
  if (!authLoading && (!user || user.isAnonymous)) {
    return (
      <Empty className="border border-white/10">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <HugeiconsIcon icon={StarIcon} />
          </EmptyMedia>
          <EmptyTitle>Sign in to view your ratings</EmptyTitle>
          <EmptyDescription>
            Rate movies and TV shows to track your opinions and see them here.
          </EmptyDescription>
        </EmptyHeader>
        <AuthModal />
      </Empty>
    )
  }

  return (
    <div className="space-y-6">
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
      ) : currentRatings.ratings.length === 0 ? (
        <Empty className="border border-white/10">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon
                icon={activeTab === "movies" ? Film01Icon : Tv01Icon}
              />
            </EmptyMedia>
            <EmptyTitle>
              No {activeTab === "movies" ? "movie" : "TV show"} ratings yet
            </EmptyTitle>
            <EmptyDescription>
              Rate {activeTab === "movies" ? "movies" : "TV shows"} from their
              detail pages to see them here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid grid-cols-2 gap-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7">
          {currentRatings.ratings
            .filter((item) => item.rating.mediaId != null)
            .map((item) => {
              // Convert rating data to TMDBMedia format
              const mediaData = item.media as any
              const media: TMDBMedia = {
                id: Number(item.rating.mediaId),
                media_type: activeTab === "movies" ? "movie" : "tv",
                poster_path:
                  mediaData?.poster_path || item.rating.posterPath || null,
                backdrop_path: mediaData?.backdrop_path || null,
                vote_average: mediaData?.vote_average || 0,
                vote_count: mediaData?.vote_count || 0,
                overview: mediaData?.overview || "",
                popularity: mediaData?.popularity || 0,
                original_language: mediaData?.original_language || "en",
                genre_ids: [],
                adult: false,
                ...(activeTab === "movies"
                  ? {
                      title:
                        mediaData?.title ||
                        mediaData?.name ||
                        item.rating.title ||
                        "Untitled",
                      original_title: mediaData?.original_title || "",
                      release_date:
                        mediaData?.release_date ||
                        item.rating.releaseDate ||
                        "",
                      video: false,
                    }
                  : {
                      name:
                        mediaData?.name ||
                        mediaData?.title ||
                        item.rating.title ||
                        "Untitled",
                      original_name: mediaData?.original_name || "",
                      first_air_date:
                        mediaData?.first_air_date ||
                        item.rating.releaseDate ||
                        "",
                      origin_country: [],
                    }),
              }

              return (
                <MediaCard
                  key={`${item.rating.mediaType}-${item.rating.mediaId}`}
                  media={media}
                  userRating={item.rating.rating}
                  onWatchTrailer={handleWatchTrailer}
                  isLoading={loadingMediaId === media.id}
                />
              )
            })}
        </div>
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
          <div className="p-3 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}
