"use client"

import { MediaCardWithActions } from "@/components/media-card-with-actions"
import { TrailerModal } from "@/components/trailer-modal"
import { useContentFilter } from "@/hooks/use-content-filter"
import { useTrailer } from "@/hooks/use-trailer"
import type { TMDBMedia } from "@/types/tmdb"

interface CollectionMoviesGridProps {
  movies: TMDBMedia[]
}

export function CollectionMoviesGrid({ movies }: CollectionMoviesGridProps) {
  const { isOpen, activeTrailer, watchTrailer, closeTrailer, loadingMediaId } =
    useTrailer()
  const filteredMovies = useContentFilter(movies)

  const handleWatchTrailer = (media: TMDBMedia) => {
    watchTrailer(media.id, "movie", media.title || "Trailer")
  }

  return (
    <>
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

      <TrailerModal
        videoKey={activeTrailer?.key || null}
        isOpen={isOpen}
        onClose={closeTrailer}
        title={activeTrailer?.title || "Trailer"}
      />
    </>
  )
}
