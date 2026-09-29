import "server-only"
import { cache } from "react"
import { getMovieGenres, getTVGenres } from "@/lib/tmdb"

export const getHistoryGenres = cache(
  async (): Promise<Record<number, string>> => {
    const [movies, tv] = await Promise.all([getMovieGenres(), getTVGenres()])
    return Object.fromEntries(
      [...movies, ...tv].map((genre) => [genre.id, genre.name]),
    )
  },
)
