import { BrowsePageClient } from "@/components/browse-page-client"
import { JsonLd } from "@/components/json-ld"
import { getTopRatedMoviesPaginated } from "@/lib/tmdb"
import { itemListSchema } from "@/lib/jsonld"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Top Rated Movies",
  description: "Discover top rated movies on ShowSeek",
}

export const revalidate = 3600 // Revalidate every hour

interface PageProps {
  searchParams: Promise<{ page?: string }>
}

export default async function TopRatedMoviesPage({ searchParams }: PageProps) {
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page || "1", 10))
  const data = await getTopRatedMoviesPaginated(page)

  return (
    <>
      <JsonLd
        data={itemListSchema({
          name: "Top Rated Movies",
          description: "Discover top rated movies on ShowSeek",
          baseUrl: "/top-rated-movies",
          page: data.page,
          items: data.results,
        })}
      />
      <BrowsePageClient
        title="Top Rated Movies"
        items={data.results}
        currentPage={data.page}
        totalPages={data.totalPages}
        totalResults={data.totalResults}
        baseUrl="/top-rated-movies"
      />
    </>
  )
}
