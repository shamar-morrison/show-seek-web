"use client"

import { fetchTrailerKey } from "@/app/actions"
import { HeroSection } from "@/components/hero-section"
import { MediaRow } from "@/components/media-row"
import { TrailerModal } from "@/components/trailer-modal"
import { TrailerRow } from "@/components/trailer-row"
import { usePreferences } from "@/hooks/use-preferences"
import { DEFAULT_HOME_LISTS } from "@/lib/home-screen-lists"
import type { TrailerItem } from "@/lib/tmdb"
import type { HeroMedia, TMDBMedia } from "@/types/tmdb"
import { useMemo, useState } from "react"
import { toast } from "sonner"

interface HomePageClientProps {
  heroMediaList: HeroMedia[]
  trendingList: TMDBMedia[]
  popularMovies: TMDBMedia[]
  topRatedTV: TMDBMedia[]
  upcomingMovies: TMDBMedia[]
  latestTrailers: TrailerItem[]
}

/** Mapping of list IDs to their display configuration */
interface ListConfig {
  title: string
  data: TMDBMedia[]
}

export function HomePageClient({
  heroMediaList,
  trendingList,
  popularMovies,
  topRatedTV,
  upcomingMovies,
  latestTrailers,
}: HomePageClientProps) {
  const { preferences, isLoading: prefsLoading } = usePreferences()
  const [isTrailerOpen, setIsTrailerOpen] = useState(false)
  const [activeTrailer, setActiveTrailer] = useState<{
    key: string
    title: string
  } | null>(null)
  const [loadingMediaId, setLoadingMediaId] = useState<string | null>(null)

  // Create mapping of list ID to data/title (for media lists, not trailers)
  const listDataMap = useMemo<Record<string, ListConfig>>(
    () => ({
      "trending-movies": { title: "Trending Movies", data: trendingList },
      "trending-tv": { title: "Trending TV Shows", data: trendingList },
      "popular-movies": { title: "Popular Movies", data: popularMovies },
      "top-rated-movies": { title: "Top Rated", data: topRatedTV },
      "upcoming-movies": { title: "Upcoming Movies", data: upcomingMovies },
      "upcoming-tv": { title: "Upcoming TV Shows", data: upcomingMovies },
    }),
    [trendingList, popularMovies, topRatedTV, upcomingMovies],
  )

  // Get user's selected lists or defaults
  const selectedLists = preferences.homeScreenLists ?? DEFAULT_HOME_LISTS

  // Filter lists - separate trailers from media lists
  const { showTrailers, visibleMediaLists } = useMemo(() => {
    const showTrailers = selectedLists.some(
      (item) => item.id === "latest-trailers",
    )
    const visibleMediaLists = selectedLists
      .filter(
        (item) =>
          item.type === "tmdb" &&
          item.id !== "latest-trailers" &&
          listDataMap[item.id],
      )
      .map((item) => ({
        id: item.id,
        ...listDataMap[item.id],
      }))
    return { showTrailers, visibleMediaLists }
  }, [selectedLists, listDataMap])

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
    const mediaType =
      (media.media_type as "movie" | "tv") || (media.title ? "movie" : "tv")
    const compositeKey = `${mediaType}-${media.id}`

    setLoadingMediaId(compositeKey)

    try {
      const key = await fetchTrailerKey(media.id, mediaType)

      if (key) {
        setActiveTrailer({
          key,
          title: title,
        })
        setIsTrailerOpen(true)
      } else {
        toast.error(`No trailer available for ${title}`)
        console.warn("No trailer found for", title)
      }
    } catch (error) {
      console.error("Error fetching trailer:", error)
    } finally {
      setLoadingMediaId(null)
    }
  }

  // Show skeleton while loading preferences (brief flash)
  if (prefsLoading) {
    return (
      <main className="min-h-screen bg-black pb-16">
        <HeroSection
          mediaList={heroMediaList}
          onWatchTrailer={handleHeroWatchTrailer}
          isPaused={isTrailerOpen}
        />
        <div className="relative z-20 -mt-24 pt-32 pointer-events-none">
          <div className="pointer-events-auto space-y-4">
            {/* Show default lists while loading */}
            {DEFAULT_HOME_LISTS.filter(
              (item) =>
                item.type === "tmdb" &&
                item.id !== "latest-trailers" &&
                listDataMap[item.id],
            ).map((item) => (
              <MediaRow
                key={item.id}
                title={listDataMap[item.id].title}
                items={listDataMap[item.id].data}
                onWatchTrailer={handleCardWatchTrailer}
                loadingMediaId={loadingMediaId}
                showActions
              />
            ))}
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-black pb-16">
      <HeroSection
        mediaList={heroMediaList}
        onWatchTrailer={handleHeroWatchTrailer}
        isPaused={isTrailerOpen}
      />

      <div className="relative z-20 -mt-24 pt-32 pointer-events-none">
        <div className="pointer-events-auto space-y-4">
          {/* Trailer Row - shown first if selected */}
          {showTrailers && latestTrailers.length > 0 && (
            <TrailerRow title="Latest Trailers" trailers={latestTrailers} />
          )}

          {/* Media Rows */}
          {visibleMediaLists.map((list) => (
            <MediaRow
              key={list.id}
              title={list.title}
              items={list.data}
              onWatchTrailer={handleCardWatchTrailer}
              loadingMediaId={loadingMediaId}
              showActions
            />
          ))}
        </div>
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
