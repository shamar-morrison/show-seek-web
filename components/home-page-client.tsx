"use client"

import { useState } from "react"
import { Navbar } from "@/components/navbar"
import { HeroSection } from "@/components/hero-section"
import { MediaRow } from "@/components/media-row"
import { TrailerModal } from "@/components/trailer-modal"
import { fetchTrailerKey } from "@/app/actions"
import type { HeroMedia, TMDBMedia } from "@/types/tmdb"

interface HomePageClientProps {
  heroMediaList: HeroMedia[]
  trendingList: TMDBMedia[]
  popularMovies: TMDBMedia[]
  topRatedTV: TMDBMedia[]
  upcomingMovies: TMDBMedia[]
}

export function HomePageClient({
  heroMediaList,
  trendingList,
  popularMovies,
  topRatedTV,
  upcomingMovies,
}: HomePageClientProps) {
  const [isTrailerOpen, setIsTrailerOpen] = useState(false)
  const [activeTrailer, setActiveTrailer] = useState<{
    key: string
    title: string
  } | null>(null)

  // Handle opening trailer for Hero Section items (pre-fetched trailerKey)
  const handleHeroWatchTrailer = (media: HeroMedia) => {
    if (media.trailerKey) {
      setActiveTrailer({
        key: media.trailerKey,
        title: media.title,
      })
      setIsTrailerOpen(true)
    }
  }

  // Handle opening trailer for Media Cards (fetch on demand)
  const handleCardWatchTrailer = async (media: TMDBMedia) => {
    // For media cards, we might need to fetch the trailer key if not present
    const title = media.title || media.name || "Trailer"

    try {
      const mediaType = media.media_type || (media.title ? "movie" : "tv")
      const key = await fetchTrailerKey(media.id, mediaType as "movie" | "tv")

      if (key) {
        setActiveTrailer({
          key,
          title: title,
        })
        setIsTrailerOpen(true)
      } else {
        // Could show a toast "No trailer available"
        console.warn("No trailer found for", title)
      }
    } catch (error) {
      console.error("Error fetching trailer:", error)
    }
  }

  return (
    <main className="min-h-screen bg-black pb-16">
      <Navbar />

      <HeroSection
        mediaList={heroMediaList}
        onWatchTrailer={handleHeroWatchTrailer}
        isPaused={isTrailerOpen}
      />

      <div className="relative z-20 -mt-24 space-y-4 pt-32">
        <MediaRow
          title="Trending Now"
          items={trendingList}
          onWatchTrailer={handleCardWatchTrailer}
        />
        <MediaRow
          title="Popular Movies"
          items={popularMovies}
          onWatchTrailer={handleCardWatchTrailer}
        />
        <MediaRow
          title="Top Rated TV Shows"
          items={topRatedTV}
          onWatchTrailer={handleCardWatchTrailer}
        />
        <MediaRow
          title="Upcoming Movies"
          items={upcomingMovies}
          onWatchTrailer={handleCardWatchTrailer}
        />
      </div>

      <TrailerModal
        videoKey={activeTrailer?.key || null}
        isOpen={isTrailerOpen}
        onClose={() => {
          setIsTrailerOpen(false)
          setActiveTrailer(null)
        }}
        title={activeTrailer?.title || "Trailer"}
      />
    </main>
  )
}
