import { CreditsClient } from "@/components/credits-client"
import { getTVDetails } from "@/lib/tmdb"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

interface CreditsPageProps {
  params: Promise<{
    id: string
  }>
}

/**
 * TV Show Credits Page
 * Displays full cast and crew list with tabs and search
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

  const cast = tvShow.credits?.cast || []
  const crew = tvShow.credits?.crew || []

  return (
    <main className="min-h-screen bg-black">
      <div className="mx-auto max-w-[1800px] px-4 pt-24 pb-12 sm:px-8 lg:px-12">
        <CreditsClient
          title={tvShow.name}
          mediaType="tv"
          mediaId={tvId}
          cast={cast}
          crew={crew}
        />
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
