"use server"

import { Navbar } from "@/components/navbar"
import { getEpisodeDetails, getSeasonDetails, getTVDetails } from "@/lib/tmdb"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { EpisodeDetailClient } from "./episode-detail-client"

interface EpisodePageProps {
  params: Promise<{
    id: string
    seasonNumber: string
    episodeNumber: string
  }>
}

/**
 * Generate metadata for SEO
 */
export async function generateMetadata({
  params,
}: EpisodePageProps): Promise<Metadata> {
  const { id, seasonNumber, episodeNumber } = await params
  const tvId = parseInt(id, 10)
  const seasonNum = parseInt(seasonNumber, 10)
  const epNum = parseInt(episodeNumber, 10)

  if (isNaN(tvId) || isNaN(seasonNum) || isNaN(epNum)) {
    return { title: "Episode Not Found" }
  }

  const [tvShow, episode] = await Promise.all([
    getTVDetails(tvId),
    getEpisodeDetails(tvId, seasonNum, epNum),
  ])

  if (!tvShow || !episode) {
    return { title: "Episode Not Found" }
  }

  return {
    title: `${episode.name} - ${tvShow.name} S${seasonNum}E${epNum} | ShowSeek`,
    description:
      episode.overview || `Watch ${episode.name} from ${tvShow.name}`,
    openGraph: {
      title: `${episode.name} - ${tvShow.name}`,
      description: episode.overview || undefined,
      images: episode.still_path
        ? [`https://image.tmdb.org/t/p/w1280${episode.still_path}`]
        : undefined,
    },
  }
}

/**
 * Episode Detail Page
 * Server component that fetches episode data and renders the client component
 */
export default async function EpisodePage({ params }: EpisodePageProps) {
  const { id, seasonNumber, episodeNumber } = await params
  const tvId = parseInt(id, 10)
  const seasonNum = parseInt(seasonNumber, 10)
  const epNum = parseInt(episodeNumber, 10)

  if (isNaN(tvId) || isNaN(seasonNum) || isNaN(epNum)) {
    notFound()
  }

  // Fetch TV show, season (for pagination), and episode details in parallel
  const [tvShow, season, episode] = await Promise.all([
    getTVDetails(tvId),
    getSeasonDetails(tvId, seasonNum),
    getEpisodeDetails(tvId, seasonNum, epNum),
  ])

  if (!tvShow || !season || !episode) {
    notFound()
  }

  return (
    <main className="min-h-screen bg-black">
      <Navbar />
      <EpisodeDetailClient
        tvShow={tvShow}
        season={season}
        episode={episode}
        tvShowId={tvId}
      />
    </main>
  )
}
