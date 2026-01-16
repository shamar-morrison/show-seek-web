import { BrowsePageClient } from "@/components/browse-page-client"
import { getTrendingTVPaginated } from "@/lib/tmdb"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Trending TV Shows",
  description: "Discover trending TV shows on ShowSeek",
}

export const revalidate = 3600 // Revalidate every hour

interface PageProps {
  searchParams: Promise<{ page?: string }>
}

export default async function TrendingTVPage({ searchParams }: PageProps) {
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page || "1", 10))
  const data = await getTrendingTVPaginated(page)

  return (
    <BrowsePageClient
      title="Trending TV Shows"
      items={data.results}
      currentPage={data.page}
      totalPages={data.totalPages}
      totalResults={data.totalResults}
      baseUrl="/trending-tv"
    />
  )
}
