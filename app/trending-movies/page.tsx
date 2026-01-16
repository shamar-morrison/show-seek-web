import { BrowsePageClient } from "@/components/browse-page-client"
import { getTrendingMoviesPaginated } from "@/lib/tmdb"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Trending Movies",
  description: "Discover trending movies on ShowSeek",
}

export const revalidate = 3600 // Revalidate every hour

interface PageProps {
  searchParams: Promise<{ page?: string }>
}

export default async function TrendingMoviesPage({ searchParams }: PageProps) {
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page || "1", 10))
  const data = await getTrendingMoviesPaginated(page)

  return (
    <BrowsePageClient
      title="Trending Movies"
      items={data.results}
      currentPage={data.page}
      totalPages={data.totalPages}
      totalResults={data.totalResults}
      baseUrl="/trending-movies"
    />
  )
}
