import { BrowsePageClient } from "@/components/browse-page-client"
import { JsonLd } from "@/components/json-ld"
import { getUpcomingMoviesPaginated } from "@/lib/tmdb"
import { itemListSchema } from "@/lib/jsonld"
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
    <>
      <JsonLd
        data={itemListSchema({
          name: "Upcoming Movies",
          description: "Discover upcoming movies on ShowSeek",
          url: "https://show-seek.app/upcoming-movies",
          items: data.results,
        })}
      />
      <BrowsePageClient
        title="Upcoming Movies"
        items={data.results}
        currentPage={data.page}
        totalPages={data.totalPages}
        totalResults={data.totalResults}
        baseUrl="/upcoming-movies"
      />
    </>
  )
}
