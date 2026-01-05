import { CastRow } from "@/components/cast-row"
import { MediaDetailHero } from "@/components/media-detail-hero"
import { Navbar } from "@/components/navbar"
import { WatchProviders } from "@/components/watch-providers"
import {
  getBestTrailer,
  getMediaVideos,
  getMovieDetails,
  getWatchProviders,
} from "@/lib/tmdb"
import { Metadata } from "next"
import { notFound } from "next/navigation"

interface MoviePageProps {
  params: Promise<{
    id: string
  }>
}

/**
 * Movie Detail Page
 * Server component that fetches movie details and renders the detail hero
 */
export default async function MoviePage({ params }: MoviePageProps) {
  const { id } = await params
  const movieId = parseInt(id, 10)

  if (isNaN(movieId)) {
    notFound()
  }

  // Fetch movie details, videos, and watch providers in parallel
  const [movie, videos, watchProviders] = await Promise.all([
    getMovieDetails(movieId),
    getMediaVideos(movieId, "movie"),
    getWatchProviders(movieId, "movie"),
  ])

  if (!movie) {
    notFound()
  }

  const trailerKey = getBestTrailer(videos)
  const cast = movie.credits?.cast || []

  return (
    <main className="min-h-screen bg-black">
      <Navbar />
      <MediaDetailHero
        media={movie}
        mediaType="movie"
        trailerKey={trailerKey}
      />
      <CastRow
        title="Cast"
        cast={cast}
        href={`/movie/${movieId}/credits`}
        limit={15}
      />
      <WatchProviders providers={watchProviders} />
    </main>
  )
}

/**
 * Generate metadata for SEO
 */
export async function generateMetadata({
  params,
}: MoviePageProps): Promise<Metadata> {
  const { id } = await params
  const movieId = parseInt(id, 10)

  if (isNaN(movieId)) {
    return { title: "Movie Not Found | ShowSeek" }
  }

  const movie = await getMovieDetails(movieId)

  if (!movie) {
    return { title: "Movie Not Found | ShowSeek" }
  }

  return {
    title: `${movie.title} | ShowSeek`,
    description: movie.overview,
  }
}
