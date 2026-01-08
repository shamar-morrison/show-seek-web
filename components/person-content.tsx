"use client"

import { fetchTrailerKey } from "@/app/actions"
import { MediaCardWithActions } from "@/components/media-card-with-actions"
import { TrailerModal } from "@/components/trailer-modal"
import { FilterTabButton } from "@/components/ui/filter-tab-button"
import { PersonCastMember, PersonCrewMember, TMDBMedia, TMDBPersonDetails } from "@/types/tmdb"
import { Film01Icon, Tv01Icon } from "@hugeicons/core-free-icons"
import { useMemo, useState } from "react"
import { toast } from "sonner"

interface PersonContentProps {
  person: TMDBPersonDetails
}

// Helper to deduplicate items by id using Set (O(n) instead of O(n²))
const deduplicateById = <T extends { id: number }>(items: T[]): T[] => {
  const seen = new Set<number>()
  return items.filter((item) => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
}

export function PersonContent({ person }: PersonContentProps) {
  const [activeTab, setActiveTab] = useState<"movie" | "tv">("movie")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [trailerKey, setTrailerKey] = useState<string | null>(null)
  const [loadingMediaId, setLoadingMediaId] = useState<number | null>(null)

  const { movieCredits, tvCredits, mediaItems, creditLabel } = useMemo(() => {
    const knownFor = person.known_for_department
    const isDirecting = knownFor === "Directing"
    const isWriting = knownFor === "Writing"

    let credits: (PersonCastMember | PersonCrewMember)[] = []
    let label = "Acting"

    if (isDirecting) {
      credits =
        person.combined_credits?.crew.filter(
          (c) => c.department === "Directing",
        ) || []
      label = "Directing"
    } else if (isWriting) {
      credits =
        person.combined_credits?.crew.filter(
          (c) => c.department === "Writing",
        ) || []
      label = "Writing"
    } else {
      credits = person.combined_credits?.cast || []
      label = "Acting"
    }

    // Split credits by media type, deduplicate, and sort by popularity
    const movies = deduplicateById(
      credits.filter((c) => c.media_type === "movie" && c.poster_path),
    ).sort((a, b) => (b.popularity || 0) - (a.popularity || 0))

    const tv = deduplicateById(
      credits.filter((c) => c.media_type === "tv" && c.poster_path),
    ).sort((a, b) => (b.popularity || 0) - (a.popularity || 0))

    const current = activeTab === "movie" ? movies : tv

    // Map to TMDBMedia for MediaCard
    const items: TMDBMedia[] = current.map((credit) => ({
      ...credit,
      original_language: "en",
      // Conditionally set original_title/original_name based on media_type
      // to avoid polluting the object with undefined values
      ...(credit.media_type === "movie"
        ? { original_title: credit.title }
        : { original_name: credit.name }),
    }))

    return {
      movieCredits: movies,
      tvCredits: tv,
      mediaItems: items,
      creditLabel: label,
    }
  }, [person, activeTab])

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
        <FilterTabButton
          label="Movies"
          count={movieCredits.length}
          isActive={activeTab === "movie"}
          icon={Film01Icon}
          onClick={() => setActiveTab("movie")}
        />
        <FilterTabButton
          label="TV Shows"
          count={tvCredits.length}
          isActive={activeTab === "tv"}
          icon={Tv01Icon}
          onClick={() => setActiveTab("tv")}
        />
      </div>

      {/* Header for list */}
      <h2 className="mb-6 text-xl font-bold text-white">
        {activeTab === "movie" ? "Movie" : "TV Show"} Credits ({creditLabel})
      </h2>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {mediaItems.map((media) => (
          <MediaCardWithActions
            key={`${media.media_type}-${media.id}`}
            media={media}
            buttonText="Trailer"
            onWatchTrailer={handleWatchTrailer}
            isLoading={loadingMediaId === media.id}
            showRating={true}
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
