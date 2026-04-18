import { toast } from "sonner"
import { showActionableSuccessToast } from "@/lib/actionable-toast"

type MovieListPayload = {
  movieId: number
  title: string
  originalTitle?: string
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
    original_title?: string
    poster_path: string | null
    media_type: "movie"
    vote_average?: number
    release_date?: string
    genre_ids?: number[]
  },
) => Promise<boolean>

type RemoveFromListFn = (listId: string, mediaId: string) => Promise<void>
type RemoveMediaFromListFn = (
  listId: string,
  mediaId: number,
  mediaType: "movie" | "tv",
) => Promise<void>

export async function applyMovieRatingListAutomation(params: {
  mediaType: "movie" | "tv"
  movie: MovieListPayload
  autoAddToAlreadyWatched: boolean
  autoRemoveFromShouldWatch: boolean
  addToList: AddToListFn
  removeFromList: RemoveFromListFn
  removeMediaFromList: RemoveMediaFromListFn
}): Promise<void> {
  const {
    mediaType,
    movie,
    autoAddToAlreadyWatched,
    autoRemoveFromShouldWatch,
    addToList,
    removeFromList,
    removeMediaFromList,
  } = params

  if (mediaType !== "movie") return

  if (autoAddToAlreadyWatched) {
    try {
      const wasAdded = await addToList("already-watched", {
        id: movie.movieId,
        title: movie.title,
        original_title: movie.originalTitle,
        poster_path: movie.posterPath,
        media_type: "movie",
        vote_average: movie.voteAverage,
        release_date: movie.releaseDate || undefined,
      })

      if (wasAdded) {
        showActionableSuccessToast("Added to Already Watched list", {
          action: {
            label: "Undo",
            onClick: () => removeFromList("already-watched", String(movie.movieId)),
            errorMessage: "Failed to remove from Already Watched list",
            logMessage: "Failed to undo auto-add to Already Watched list:",
          },
        })
      }
    } catch (listError) {
      console.error("Failed to auto-add to Already Watched list:", listError)
      const errorMessage =
        listError instanceof Error ? listError.message : "Unknown error"
      toast.error(`Failed to auto-add to Already Watched list: ${errorMessage}`)
    }
  }

  if (autoRemoveFromShouldWatch) {
    try {
      await removeMediaFromList("watchlist", movie.movieId, "movie")
    } catch (listError) {
      console.error("Failed to auto-remove from Should Watch list:", listError)
    }
  }
}

export async function applyWatchedMovieListAutomation(params: {
  movie: MovieListPayload
  isFirstWatch: boolean
  autoAddToAlreadyWatched: boolean
  autoRemoveFromShouldWatch: boolean
  addToList: AddToListFn
  removeFromList: RemoveFromListFn
  removeMediaFromList: RemoveMediaFromListFn
}): Promise<void> {
  const {
    movie,
    isFirstWatch,
    autoAddToAlreadyWatched,
    autoRemoveFromShouldWatch,
    addToList,
    removeMediaFromList,
  } = params

  if (isFirstWatch && autoAddToAlreadyWatched) {
    try {
      await addToList("already-watched", {
        id: movie.movieId,
        title: movie.title,
        original_title: movie.originalTitle,
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

  if (autoRemoveFromShouldWatch) {
    try {
      await removeMediaFromList("watchlist", movie.movieId, "movie")
    } catch (listError) {
      console.error(
        'Failed to auto-remove movie from "Should Watch" list:',
        listError,
      )
    }
  }
}
