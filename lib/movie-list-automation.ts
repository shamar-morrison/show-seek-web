import { isMovieInCachedWatchlist } from "@/lib/watchlist-cache"
import type { QueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

type MovieListPayload = {
  movieId: number
  title: string
  posterPath: string | null
  voteAverage?: number
  releaseDate?: string | null
  genreIds?: number[]
}

type AddToListFn = (
  listId: string,
  mediaItem: {
    id: number
    title: string
    poster_path: string | null
    media_type: "movie"
    vote_average?: number
    release_date?: string
    genre_ids?: number[]
  },
) => Promise<boolean>

type RemoveFromListFn = (listId: string, mediaId: string) => Promise<void>

export async function applyMovieRatingListAutomation(params: {
  mediaType: "movie" | "tv"
  movie: MovieListPayload
  queryClient: QueryClient
  userId: string | null
  autoAddToAlreadyWatched: boolean
  autoRemoveFromShouldWatch: boolean
  addToList: AddToListFn
  removeFromList: RemoveFromListFn
}): Promise<void> {
  const {
    mediaType,
    movie,
    queryClient,
    userId,
    autoAddToAlreadyWatched,
    autoRemoveFromShouldWatch,
    addToList,
    removeFromList,
  } = params

  if (mediaType !== "movie") return

  if (autoAddToAlreadyWatched) {
    try {
      const wasAdded = await addToList("already-watched", {
        id: movie.movieId,
        title: movie.title,
        poster_path: movie.posterPath,
        media_type: "movie",
        vote_average: movie.voteAverage,
        release_date: movie.releaseDate || undefined,
      })

      if (wasAdded) {
        toast.success("Added to Already Watched list")
      }
    } catch (listError) {
      console.error("Failed to auto-add to Already Watched list:", listError)
      const errorMessage =
        listError instanceof Error ? listError.message : "Unknown error"
      toast.error(`Failed to auto-add to Already Watched list: ${errorMessage}`)
    }
  }

  if (
    autoRemoveFromShouldWatch &&
    isMovieInCachedWatchlist(queryClient, userId, movie.movieId)
  ) {
    try {
      await removeFromList("watchlist", String(movie.movieId))
    } catch (listError) {
      console.error("Failed to auto-remove from Should Watch list:", listError)
    }
  }
}

export async function applyWatchedMovieListAutomation(params: {
  movie: MovieListPayload
  queryClient: QueryClient
  userId: string | null
  isFirstWatch: boolean
  autoAddToAlreadyWatched: boolean
  autoRemoveFromShouldWatch: boolean
  addToList: AddToListFn
  removeFromList: RemoveFromListFn
}): Promise<void> {
  const {
    movie,
    queryClient,
    userId,
    isFirstWatch,
    autoAddToAlreadyWatched,
    autoRemoveFromShouldWatch,
    addToList,
    removeFromList,
  } = params

  if (isFirstWatch && autoAddToAlreadyWatched) {
    try {
      await addToList("already-watched", {
        id: movie.movieId,
        title: movie.title,
        poster_path: movie.posterPath,
        media_type: "movie",
        vote_average: movie.voteAverage,
        release_date: movie.releaseDate || undefined,
        genre_ids: movie.genreIds,
      })
    } catch (listError) {
      const movieLabel = movie.title.trim() || `movie #${movie.movieId}`
      const errorDetail =
        listError instanceof Error ? `: ${listError.message}` : ""
      toast.error(
        `Failed to auto-add "${movieLabel}" to Already Watched list${errorDetail}`,
      )
    }
  }

  if (
    autoRemoveFromShouldWatch &&
    isMovieInCachedWatchlist(queryClient, userId, movie.movieId)
  ) {
    try {
      await removeFromList("watchlist", String(movie.movieId))
    } catch (listError) {
      console.error(
        'Failed to auto-remove movie from "Should Watch" list:',
        listError,
      )
    }
  }
}
