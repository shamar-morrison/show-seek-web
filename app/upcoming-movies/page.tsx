import { BrowsePageClient } from "@/components/browse-page-client"
import { getUpcomingMoviesPaginated } from "@/lib/tmdb"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Upcoming Movies",
  description: "Discover upcoming movies on ShowSeek",
}

export const revalidate = 3600 // Revalidate every hour

interface PageProps {
  searchParams: Promise<{ page?: string }>
}

export default async function UpcomingMoviesPage({ searchParams }: PageProps) {
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page || "1", 10))
  const data = await getUpcomingMoviesPaginated(page)

  return (
    <BrowsePageClient
      title="Upcoming Movies"
      items={data.results}
      currentPage={data.page}
      totalPages={data.totalPages}
      totalResults={data.totalResults}
      baseUrl="/upcoming-movies"
    />
  )
}
