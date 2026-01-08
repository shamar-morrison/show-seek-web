import { getSeasonDetails, getTVDetails } from "@/lib/tmdb"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { SeasonDetailClient } from "./season-detail-client"

interface SeasonPageProps {
  params: Promise<{
    id: string
    seasonNumber: string
  }>
}

/**
 * Season Detail Page
 * Displays season info and episode list with watch tracking
 */
export default async function SeasonPage({ params }: SeasonPageProps) {
  const { id, seasonNumber } = await params
  const tvId = parseInt(id, 10)
  const seasonNum = parseInt(seasonNumber, 10)

  if (isNaN(tvId) || isNaN(seasonNum)) {
    notFound()
  }

  // Fetch TV show details and season details in parallel
  const [tvShow, season] = await Promise.all([
    getTVDetails(tvId),
    getSeasonDetails(tvId, seasonNum),
  ])

  if (!tvShow || !season) {
    notFound()
  }

  return (
    <main className="min-h-screen bg-black">
      <SeasonDetailClient tvShow={tvShow} season={season} tvShowId={tvId} />
    </main>
  )
}

/**
 * Generate metadata for SEO
 */
export async function generateMetadata({
  params,
}: SeasonPageProps): Promise<Metadata> {
  const { id, seasonNumber } = await params
  const tvId = parseInt(id, 10)
  const seasonNum = parseInt(seasonNumber, 10)

  if (isNaN(tvId) || isNaN(seasonNum)) {
    return { title: "Season Not Found | ShowSeek" }
  }

  const [tvShow, season] = await Promise.all([
    getTVDetails(tvId),
    getSeasonDetails(tvId, seasonNum),
  ])

  if (!tvShow || !season) {
    return { title: "Season Not Found | ShowSeek" }
  }

  const posterUrl = season.poster_path
    ? `https://image.tmdb.org/t/p/w500${season.poster_path}`
    : tvShow.poster_path
      ? `https://image.tmdb.org/t/p/w500${tvShow.poster_path}`
      : undefined

  return {
    title: `${season.name} - ${tvShow.name} | ShowSeek`,
    description: season.overview || tvShow.overview,
    openGraph: {
      title: `${season.name} - ${tvShow.name}`,
      description: season.overview || tvShow.overview || undefined,
      type: "video.tv_show",
      ...(posterUrl && {
        images: [
          {
            url: posterUrl,
            width: 500,
            height: 750,
            alt: season.name,
          },
        ],
      }),
    },
    twitter: {
      card: "summary",
      title: `${season.name} - ${tvShow.name}`,
      description: season.overview || tvShow.overview || undefined,
      ...(posterUrl && { images: [posterUrl] }),
    },
  }
}
