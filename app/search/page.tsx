import { SearchResultsClient } from "@/app/search/search-results-client"
import { Navbar } from "@/components/navbar"
import { multiSearch } from "@/lib/tmdb"
import { Metadata } from "next"

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>
}

/**
 * Search Results Page
 * Displays full search results with filtering tabs
 */
export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q: query } = await searchParams
  const searchQuery = query?.trim() || ""

  // Fetch initial results server-side
  const results = searchQuery
    ? await multiSearch(searchQuery)
    : { page: 1, results: [], total_pages: 0, total_results: 0 }

  return (
    <main className="min-h-screen bg-black">
      <Navbar />
      <div className="mx-auto max-w-[1800px] px-4 pt-36 sm:px-8 lg:px-12">
        <SearchResultsClient
          initialQuery={searchQuery}
          initialResults={results}
        />
      </div>
    </main>
  )
}

/**
 * Generate metadata for SEO
 */
export async function generateMetadata({
  searchParams,
}: SearchPageProps): Promise<Metadata> {
  const { q: query } = await searchParams

  if (!query) {
    return {
      title: "Search | ShowSeek",
      description: "Search for movies, TV shows, and people",
    }
  }

  return {
    title: `Search results for "${query}" | ShowSeek`,
    description: `Find movies, TV shows, and people matching "${query}"`,
  }
}
