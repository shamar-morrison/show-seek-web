import { CastRow } from "@/components/cast-row"
import { MediaDetailHero } from "@/components/media-detail-hero"
import { Navbar } from "@/components/navbar"
import { PhotosSection } from "@/components/photos-section"
import { SimilarMedia } from "@/components/similar-media"
import { WatchProviders } from "@/components/watch-providers"
import {
  getBestTrailer,
  getMediaVideos,
  getMovieDetails,
  getSimilarMedia,
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

  // Fetch movie details, videos, watch providers, and similar movies in parallel
  const [movie, videos, watchProviders, similarMovies] = await Promise.all([
    getMovieDetails(movieId),
    getMediaVideos(movieId, "movie"),
    getWatchProviders(movieId, "movie"),
    getSimilarMedia(movieId, "movie"),
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
      <SimilarMedia
        title="Similar Movies"
        items={similarMovies}
        mediaType="movie"
      />
      <PhotosSection mediaId={movieId} mediaType="movie" />
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

  const backdropUrl = movie.backdrop_path
    ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}`
    : undefined

  return {
    title: `${movie.title} | ShowSeek`,
    description: movie.overview,
    openGraph: {
      title: movie.title,
      description: movie.overview || undefined,
      type: "video.movie",
      ...(backdropUrl && {
        images: [
          {
            url: backdropUrl,
            width: 1280,
            height: 720,
            alt: movie.title,
          },
        ],
      }),
    },
    twitter: {
      card: "summary_large_image",
      title: movie.title,
      description: movie.overview || undefined,
      ...(backdropUrl && { images: [backdropUrl] }),
    },
  }
}
