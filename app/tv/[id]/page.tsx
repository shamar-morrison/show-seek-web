import { MediaDetailHero } from "@/components/media-detail-hero"
import { Navbar } from "@/components/navbar"
import { getMediaVideos, getTVDetails } from "@/lib/tmdb"
import { notFound } from "next/navigation"

interface TVPageProps {
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
 * TV Show Detail Page
 * Server component that fetches TV show details and renders the detail hero
 */
export default async function TVPage({ params }: TVPageProps) {
  const { id } = await params
  const tvId = parseInt(id, 10)

  if (isNaN(tvId)) {
    notFound()
  }

  // Fetch TV show details and videos in parallel
  const [tvShow, videos] = await Promise.all([
    getTVDetails(tvId),
    getMediaVideos(tvId, "tv"),
  ])

  if (!tvShow) {
    notFound()
  }

  const trailerKey = getBestTrailerKey(videos)

  return (
    <main className="min-h-screen bg-black">
      <Navbar />
      <MediaDetailHero media={tvShow} mediaType="tv" trailerKey={trailerKey} />
    </main>
  )
}

/**
 * Generate metadata for SEO
 */
export async function generateMetadata({ params }: TVPageProps) {
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
