import { BrowsePageClient } from "@/components/browse-page-client"
import { getUpcomingTVPaginated } from "@/lib/tmdb"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Upcoming TV Shows",
  description: "Discover upcoming TV shows on ShowSeek",
}

export const revalidate = 3600 // Revalidate every hour

interface PageProps {
  searchParams: Promise<{ page?: string }>
}

export default async function UpcomingTVPage({ searchParams }: PageProps) {
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page || "1", 10))
  const data = await getUpcomingTVPaginated(page)

  return (
    <BrowsePageClient
      title="Upcoming TV Shows"
      items={data.results}
      currentPage={data.page}
      totalPages={data.totalPages}
      totalResults={data.totalResults}
      baseUrl="/upcoming-tv"
    />
  )
}
