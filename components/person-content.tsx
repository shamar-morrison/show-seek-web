"use client"

import { fetchTrailerKey } from "@/app/actions"
import { MediaCard } from "@/components/media-card"
import { TrailerModal } from "@/components/trailer-modal"
import { TMDBMedia, TMDBPersonDetails } from "@/types/tmdb"
import { Film01Icon, Tv01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useState } from "react"
import { toast } from "sonner"

interface PersonContentProps {
  person: TMDBPersonDetails
}

export function PersonContent({ person }: PersonContentProps) {
  const [activeTab, setActiveTab] = useState<"movie" | "tv">("movie")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [trailerKey, setTrailerKey] = useState<string | null>(null)
  const [loadingMediaId, setLoadingMediaId] = useState<number | null>(null)

  const credits = person.combined_credits?.cast || []

  // Split credits
  const movieCredits = credits
    .filter((c) => c.media_type === "movie" && c.poster_path)
    .filter((c, index, self) => index === self.findIndex((t) => t.id === c.id))
    .sort((a, b) => (b.release_date || "").localeCompare(a.release_date || ""))

  const tvCredits = credits
    .filter((c) => c.media_type === "tv" && c.poster_path)
    .filter((c, index, self) => index === self.findIndex((t) => t.id === c.id))
    .sort((a, b) =>
      (b.first_air_date || "").localeCompare(a.first_air_date || ""),
    )

  const currentCredits = activeTab === "movie" ? movieCredits : tvCredits

  // Map to TMDBMedia for MediaCard
  const mediaItems: TMDBMedia[] = currentCredits.map((credit) => ({
    ...credit,
    original_language: "en", // Placeholder
    original_title: credit.title,
    original_name: credit.name,
  }))

  const handleWatchTrailer = async (media: TMDBMedia) => {
    setLoadingMediaId(media.id)
    try {
      const key = await fetchTrailerKey(
        media.id,
        media.media_type as "movie" | "tv",
      )
      if (key) {
        setTrailerKey(key)
        setIsModalOpen(true)
      } else {
        toast.error("No trailer available for this title")
      }
    } catch (error) {
      toast.error("Failed to load trailer")
    } finally {
      setLoadingMediaId(null)
    }
  }

  return (
    <div className="mt-8">
      {/* Tabs */}
      <div className="mb-8 flex flex-wrap gap-2 border-b border-white/10 pb-4">
        {/* Movie Tab */}
        <button
          onClick={() => setActiveTab("movie")}
          className={`group flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "movie"
              ? "bg-primary text-white hover:bg-primary/90"
              : "text-gray-400 hover:bg-white/10 hover:text-white"
          }`}
        >
          <HugeiconsIcon icon={Film01Icon} className="size-4" />
          <span>Movies</span>
          <span
            className={`ml-1 rounded-full px-2 py-0.5 text-xs ${
              activeTab === "movie"
                ? "bg-white/20 text-white"
                : "bg-white/10 text-gray-500"
            }`}
          >
            {movieCredits.length}
          </span>
        </button>

        {/* TV Tab */}
        <button
          onClick={() => setActiveTab("tv")}
          className={`group flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "tv"
              ? "bg-primary text-white hover:bg-primary/90"
              : "text-gray-400 hover:bg-white/10 hover:text-white"
          }`}
        >
          <HugeiconsIcon icon={Tv01Icon} className="size-4" />
          <span>TV Shows</span>
          <span
            className={`ml-1 rounded-full px-2 py-0.5 text-xs ${
              activeTab === "tv"
                ? "bg-white/20 text-white"
                : "bg-white/10 text-gray-500"
            }`}
          >
            {tvCredits.length}
          </span>
        </button>
      </div>

      {/* Header for list */}
      <h2 className="mb-6 text-xl font-bold text-white">
        {activeTab === "movie" ? "Movie" : "TV Show"} Appearances (Acting)
      </h2>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {mediaItems.map((media) => (
          <MediaCard
            key={`${media.media_type}-${media.id}`}
            media={media}
            buttonText="Trailer"
            onWatchTrailer={handleWatchTrailer}
            isLoading={loadingMediaId === media.id}
          />
        ))}

        {mediaItems.length === 0 && (
          <div className="col-span-full py-12 text-center text-gray-500">
            No {activeTab === "movie" ? "movies" : "TV shows"} found.
          </div>
        )}
      </div>

      <TrailerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        videoKey={trailerKey}
      />
    </div>
  )
}
