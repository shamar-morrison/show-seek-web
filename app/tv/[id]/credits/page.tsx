import { getTVDetails } from "@/lib/tmdb"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

interface CreditsPageProps {
  params: Promise<{
    id: string
  }>
}

/**
 * TV Show Credits Page (Placeholder)
 * Will display full cast and crew list
 */
export default async function TVCreditsPage({ params }: CreditsPageProps) {
  const { id } = await params
  const tvId = parseInt(id, 10)

  if (isNaN(tvId)) {
    notFound()
  }

  const tvShow = await getTVDetails(tvId)

  if (!tvShow) {
    notFound()
  }

  return (
    <main className="min-h-screen bg-black">
      <div className="mx-auto max-w-[1800px] px-4 pt-24 sm:px-8 lg:px-12">
        <h1 className="text-3xl font-bold text-white mb-4">
          {tvShow.name} - Cast & Crew
        </h1>
        <p className="text-gray-400">
          Full cast and crew listing coming soon...
        </p>
      </div>
    </main>
  )
}

/**
 * Generate metadata for SEO
 */
export async function generateMetadata({
  params,
}: CreditsPageProps): Promise<Metadata> {
  const { id } = await params
  const tvId = parseInt(id, 10)

  if (isNaN(tvId)) {
    return { title: "Credits Not Found | ShowSeek" }
  }

  const tvShow = await getTVDetails(tvId)

  if (!tvShow) {
    return { title: "Credits Not Found | ShowSeek" }
  }

  return {
    title: `${tvShow.name} - Cast & Crew | ShowSeek`,
    description: `Full cast and crew for ${tvShow.name}`,
  }
}
