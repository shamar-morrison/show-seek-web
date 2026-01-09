import { CreditsClient } from "@/components/credits-client"
import { getMovieDetails } from "@/lib/tmdb"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

interface CreditsPageProps {
  params: Promise<{
    id: string
  }>
}

/**
 * Movie Credits Page
 * Displays full cast and crew list with tabs and search
 */
export default async function MovieCreditsPage({ params }: CreditsPageProps) {
  const { id } = await params
  const movieId = parseInt(id, 10)

  if (isNaN(movieId)) {
    notFound()
  }

  const movie = await getMovieDetails(movieId)

  if (!movie) {
    notFound()
  }

  const cast = movie.credits?.cast || []
  const crew = movie.credits?.crew || []

  return (
    <main className="min-h-screen bg-black">
      <div className="mx-auto max-w-[1800px] px-4 pt-24 pb-12 sm:px-8 lg:px-12">
        <CreditsClient
          title={movie.title}
          mediaType="movie"
          mediaId={movieId}
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
  const movieId = parseInt(id, 10)

  if (isNaN(movieId)) {
    return { title: "Credits Not Found | ShowSeek" }
  }

  const movie = await getMovieDetails(movieId)

  if (!movie) {
    return { title: "Credits Not Found | ShowSeek" }
  }

  return {
    title: `${movie.title} - Cast & Crew | ShowSeek`,
    description: `Full cast and crew for ${movie.title}`,
  }
}
