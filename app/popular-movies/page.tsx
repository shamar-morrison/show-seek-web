import { BrowsePageClient } from "@/components/browse-page-client"
import { getPopularMoviesPaginated } from "@/lib/tmdb"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Popular Movies",
  description: "Discover popular movies on ShowSeek",
}

export const revalidate = 3600 // Revalidate every hour

interface PageProps {
  searchParams: Promise<{ page?: string }>
}

export default async function PopularMoviesPage({ searchParams }: PageProps) {
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page || "1", 10))
  const data = await getPopularMoviesPaginated(page)

  return (
    <BrowsePageClient
      title="Popular Movies"
      items={data.results}
      currentPage={data.page}
      totalPages={data.totalPages}
      totalResults={data.totalResults}
      baseUrl="/popular-movies"
    />
  )
}
