import { CastRow } from "@/components/cast-row"
import { MediaDetailHero } from "@/components/media-detail-hero"
import { Navbar } from "@/components/navbar"
import { SimilarMedia } from "@/components/similar-media"
import { WatchProviders } from "@/components/watch-providers"
import {
  getBestTrailer,
  getMediaVideos,
  getSimilarMedia,
  getTVDetails,
  getWatchProviders,
} from "@/lib/tmdb"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

interface TVPageProps {
  params: Promise<{
    id: string
  }>
}

/**
 * TV Show Detail Page
 * Server component that fetches TV show details and renders the detail hero
 */
export default async function TVPage({ params }: TVPageProps) {
  const { id } = await params
  const tvId = parseInt(id, 10)

  if (isNaN(tvId)) {
    notFound()
  }

  // Fetch TV show details, videos, watch providers, and similar shows in parallel
  const [tvShow, videos, watchProviders, similarShows] = await Promise.all([
    getTVDetails(tvId),
    getMediaVideos(tvId, "tv"),
    getWatchProviders(tvId, "tv"),
    getSimilarMedia(tvId, "tv"),
  ])

  if (!tvShow) {
    notFound()
  }

  const trailerKey = getBestTrailer(videos)
  const cast = tvShow.credits?.cast || []

  return (
    <main className="min-h-screen bg-black">
      <Navbar />
      <MediaDetailHero media={tvShow} mediaType="tv" trailerKey={trailerKey} />
      <CastRow
        title="Cast"
        cast={cast}
        href={`/tv/${tvId}/credits`}
        limit={15}
      />
      <WatchProviders providers={watchProviders} />
      <SimilarMedia title="Similar Shows" items={similarShows} mediaType="tv" />
    </main>
  )
}

/**
 * Generate metadata for SEO
 */
export async function generateMetadata({
  params,
}: TVPageProps): Promise<Metadata> {
  const { id } = await params
  const tvId = parseInt(id, 10)

  if (isNaN(tvId)) {
    return { title: "TV Show Not Found | ShowSeek" }
  }

  const tvShow = await getTVDetails(tvId)

  if (!tvShow) {
    return { title: "TV Show Not Found | ShowSeek" }
  }

  return {
    title: `${tvShow.name} | ShowSeek`,
    description: tvShow.overview,
  }
}
