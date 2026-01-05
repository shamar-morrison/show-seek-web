import { MediaDetailHero } from "@/components/media-detail-hero"
import { Navbar } from "@/components/navbar"
import { getMediaVideos, getMovieDetails } from "@/lib/tmdb"
import { notFound } from "next/navigation"

interface MoviePageProps {
  params: Promise<{
    id: string
  }>
}

/**
 * Get best trailer key from videos response
 */
function getBestTrailerKey(
  videos: {
    results: Array<{
      site: string
      key: string
      type: string
      official: boolean
    }>
  } | null,
): string | null {
  if (!videos || !videos.results) return null

  const youtubeVideos = videos.results.filter(
    (v) => v.site === "YouTube" && v.key,
  )
  if (youtubeVideos.length === 0) return null

  const trailer =
    youtubeVideos.find((v) => v.type === "Trailer" && v.official) ||
    youtubeVideos.find((v) => v.type === "Trailer") ||
    youtubeVideos.find((v) => v.type === "Teaser") ||
    youtubeVideos[0]

  return trailer?.key || null
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

  // Fetch movie details and videos in parallel
  const [movie, videos] = await Promise.all([
    getMovieDetails(movieId),
    getMediaVideos(movieId, "movie"),
  ])

  if (!movie) {
    notFound()
  }

  const trailerKey = getBestTrailerKey(videos)

  return (
    <main className="min-h-screen bg-black">
      <Navbar />
      <MediaDetailHero
        media={movie}
        mediaType="movie"
        trailerKey={trailerKey}
      />
    </main>
  )
}

/**
 * Generate metadata for SEO
 */
export async function generateMetadata({ params }: MoviePageProps) {
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
