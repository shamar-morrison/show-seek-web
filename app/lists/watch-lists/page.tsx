import { WatchListsClient } from "@/app/lists/watch-lists/watch-lists-client"
import { PageHeader } from "@/components/page-header"
import { getMovieGenres, getTVGenres } from "@/lib/tmdb"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Watch Lists | ShowSeek",
  description: "Manage your movie and TV show watch lists",
}

/**
 * Watch Lists Page
 * Displays user's default lists with tab navigation and search filtering
 */
export default async function WatchListsPage() {
  // Fetch genres in parallel - these are cached indefinitely
  const [movieGenres, tvGenres] = await Promise.all([
    getMovieGenres(),
    getTVGenres(),
  ])

  return (
    <>
      <PageHeader title="Watch Lists" />
      <WatchListsClient movieGenres={movieGenres} tvGenres={tvGenres} />
    </>
  )
}
