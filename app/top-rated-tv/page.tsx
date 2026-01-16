import { BrowsePageClient } from "@/components/browse-page-client"
import { getTopRatedTVPaginated } from "@/lib/tmdb"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Top Rated TV Shows",
  description: "Discover top rated TV shows on ShowSeek",
}

export const revalidate = 3600 // Revalidate every hour

interface PageProps {
  searchParams: Promise<{ page?: string }>
}

export default async function TopRatedTVPage({ searchParams }: PageProps) {
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page || "1", 10))
  const data = await getTopRatedTVPaginated(page)

  return (
    <BrowsePageClient
      title="Top Rated TV Shows"
      items={data.results}
      currentPage={data.page}
      totalPages={data.totalPages}
      totalResults={data.totalResults}
      baseUrl="/top-rated-tv"
    />
  )
}
