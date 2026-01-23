"use client"

import { MediaCardWithActions } from "@/components/media-card-with-actions"
import { TrailerModal } from "@/components/trailer-modal"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { useAuth } from "@/context/auth-context"
import { useContentFilter } from "@/hooks/use-content-filter"
import { usePreferences } from "@/hooks/use-preferences"
import { useTrailer } from "@/hooks/use-trailer"
import type { TMDBMedia } from "@/types/tmdb"
import { ViewIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

interface CollectionMoviesGridProps {
  movies: TMDBMedia[]
}

export function CollectionMoviesGrid({ movies }: CollectionMoviesGridProps) {
  const { isPremium } = useAuth()
  const { preferences } = usePreferences()
  const { isOpen, activeTrailer, watchTrailer, closeTrailer, loadingMediaId } =
    useTrailer()
  const filteredMovies = useContentFilter(movies)

  const handleWatchTrailer = (media: TMDBMedia) => {
    watchTrailer(media.id, "movie", media.title || "Trailer")
  }

  const isHidingWatched = isPremium && preferences.hideWatchedContent
  const allWatched = movies.length > 0 && filteredMovies.length === 0

  return (
    <>
      {allWatched ? (
        <Empty className="py-20">
          <EmptyMedia variant="icon">
            <HugeiconsIcon icon={ViewIcon} className="size-6" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>No movies to show</EmptyTitle>
            <EmptyDescription>
              {isHidingWatched
                ? "All movies in this collection are marked as watched and are currently hidden by your preferences."
                : "There are no movies in this collection."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid grid-cols-2 gap-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7">
          {filteredMovies.map((movie) => (
            <MediaCardWithActions
              key={`${movie.media_type || "movie"}-${movie.id}`}
              media={movie}
              onWatchTrailer={handleWatchTrailer}
              isLoading={
                loadingMediaId === `${movie.media_type || "movie"}-${movie.id}`
              }
            />
          ))}
        </div>
      )}

      <TrailerModal
        videoKey={activeTrailer?.key || null}
        isOpen={isOpen}
        onClose={closeTrailer}
        title={activeTrailer?.title || "Trailer"}
      />
    </>
  )
}
