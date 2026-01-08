import { CastRow } from "@/components/cast-row"
import { MediaDetailHero } from "@/components/media-detail-hero"
import { MediaDetails } from "@/components/media-details"
import { PhotosSection } from "@/components/photos-section"
import { RecommendationsSection } from "@/components/recommendations-section"
import { ReviewsSection } from "@/components/reviews-section"
import { SeasonsRow } from "@/components/seasons-row"
import { SimilarMedia } from "@/components/similar-media"
import { VideosSection } from "@/components/videos-section"
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
  const seasons = tvShow.seasons || []

  return (
    <main className="min-h-screen bg-black">
      <MediaDetailHero media={tvShow} mediaType="tv" trailerKey={trailerKey} />
      <SeasonsRow title="Seasons" seasons={seasons} tvShowId={tvId} />
      <CastRow
        title="Cast"
        cast={cast}
        href={`/tv/${tvId}/credits`}
        limit={15}
      />
      <WatchProviders providers={watchProviders} />
      <SimilarMedia title="Similar Shows" items={similarShows} mediaType="tv" />
      <PhotosSection mediaId={tvId} mediaType="tv" />
      <VideosSection mediaId={tvId} mediaType="tv" />
      <RecommendationsSection mediaId={tvId} mediaType="tv" />
      <ReviewsSection mediaId={tvId} mediaType="tv" />
      <MediaDetails media={tvShow} mediaType="tv" />
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

  const backdropUrl = tvShow.backdrop_path
    ? `https://image.tmdb.org/t/p/w1280${tvShow.backdrop_path}`
    : undefined

  return {
    title: `${tvShow.name} | ShowSeek`,
    description: tvShow.overview,
    openGraph: {
      title: tvShow.name,
      description: tvShow.overview || undefined,
      type: "video.tv_show",
      ...(backdropUrl && {
        images: [
          {
            url: backdropUrl,
            width: 1280,
            height: 720,
            alt: tvShow.name,
          },
        ],
      }),
    },
    twitter: {
      card: "summary_large_image",
      title: tvShow.name,
      description: tvShow.overview || undefined,
      ...(backdropUrl && { images: [backdropUrl] }),
    },
  }
}
