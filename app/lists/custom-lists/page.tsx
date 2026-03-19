import { getMovieGenres, getTVGenres } from "@/lib/tmdb"
import { Metadata } from "next"
import { CustomListsClient } from "./custom-lists-client"

export const metadata: Metadata = {
  title: "Custom Lists | ShowSeek",
  description: "Manage your custom movie and TV show lists",
}

interface CustomListsPageProps {
  searchParams: Promise<{ listId?: string | string[] }>
}

/**
 * Custom Lists Page
 * Displays user's custom lists with tab navigation and search filtering
 */
export default async function CustomListsPage({
  searchParams,
}: CustomListsPageProps) {
  const params = await searchParams
  const initialListId = Array.isArray(params.listId)
    ? params.listId[0]
    : params.listId

  // Fetch genres in parallel - these are cached indefinitely
  const [movieGenres, tvGenres] = await Promise.all([
    getMovieGenres(),
    getTVGenres(),
  ])

  // Check for failures
  const genreFetchError =
    movieGenres.length === 0 || tvGenres.length === 0
      ? "Failed to load some filter options. Genre filtering may be limited."
      : undefined

  return (
    <>
      <CustomListsClient
        movieGenres={movieGenres}
        tvGenres={tvGenres}
        genreFetchError={genreFetchError}
        initialListId={initialListId}
      />
    </>
  )
}
